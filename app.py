import os
import re
import json
import hmac
import time
import hashlib
import uuid
import base64
import threading
import mimetypes
import requests
from datetime import datetime, timezone
from functools import wraps

from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras
import psycopg2.pool
from supabase import create_client, Client

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-key")
# The site and API share one origin, so cross-origin access stays off unless
# ALLOWED_ORIGINS lists other front-ends (comma separated).
_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
if _origins:
    CORS(app, resources={r"/api/*": {"origins": _origins}})

# Static files carry a ?v= version in index.html, so browsers can cache them for a week
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 7 * 24 * 3600
# Uploads now go straight to Supabase; this only guards the fallback route
app.config["MAX_CONTENT_LENGTH"] = 60 * 1024 * 1024

# gzip/brotli for HTML, CSS, JS and JSON (optional: pip install flask-compress)
try:
    from flask_compress import Compress
    Compress(app)
except ImportError:
    pass

def _asset_version():
    """Changes whenever a file in /static changes, so deploys bust the browser cache."""
    newest = 0
    for root, _, files in os.walk(os.path.join(app.root_path, "static")):
        for f in files:
            newest = max(newest, int(os.path.getmtime(os.path.join(root, f))))
    return str(newest)
ASSET_VERSION = _asset_version()

SUPABASE_URL        = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY   = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY= os.getenv("SUPABASE_SERVICE_ROLE_KEY")
ADMIN_EMAIL         = os.getenv("ADMIN_EMAIL", "michaelmalaba3634@gmail.com")

supabase:       Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

DATABASE_URL = os.getenv("DATABASE_URL")

PAYHERO_USERNAME   = os.getenv("PAYHERO_API_USERNAME", "placeholder")
PAYHERO_PASSWORD   = os.getenv("PAYHERO_API_PASSWORD", "placeholder")
PAYHERO_CHANNEL_ID = os.getenv("PAYHERO_CHANNEL_ID",  "placeholder")
PAYHERO_CALLBACK   = os.getenv("PAYHERO_CALLBACK_URL", "https://mynyumba.onrender.com/api/mpesa/callback")
PAYHERO_STK_URL    = "https://backend.payhero.co.ke/api/v2/payments"

def payhero_auth():
    """Basic auth header for PayHero."""
    creds = base64.b64encode(
        f"{PAYHERO_USERNAME}:{PAYHERO_PASSWORD}".encode()
    ).decode()
    return {"Authorization": f"Basic {creds}", "Content-Type": "application/json"}

# ── Database connection pool ────────────────────────────────────────────────
# Opening a new TLS connection to Supabase on every request costs 100–300ms.
# A small pool reuses connections. conn.close() hands the connection back to
# the pool instead of closing it, so the route code below doesn't change.
_pool = None
_pool_lock = threading.Lock()
_last_used = {}   # id(connection) -> time it was last handed out
DB_POOL_MAX = int(os.getenv("DB_POOL_MAX", "10"))

def _get_pool():
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _pool = psycopg2.pool.ThreadedConnectionPool(
                    1, DB_POOL_MAX, DATABASE_URL,
                    cursor_factory=psycopg2.extras.RealDictCursor,
                    keepalives=1, keepalives_idle=30, keepalives_interval=10, keepalives_count=3,
                    connect_timeout=10)
    return _pool

class _PooledConn:
    """Wraps a pooled psycopg2 connection; close() returns it to the pool."""
    def __init__(self, pool, conn):
        self._pool, self._conn = pool, conn
    def __getattr__(self, name):
        return getattr(self._conn, name)
    def close(self):
        conn, self._conn = self._conn, None
        if conn is None:
            return
        broken = bool(conn.closed)
        if not broken:
            try:
                conn.rollback()   # end any read-only transaction left open
            except Exception:
                broken = True
        if broken:
            _last_used.pop(id(conn), None)
        try:
            self._pool.putconn(conn, close=broken)
        except Exception:
            pass
    def __del__(self):
        try: self.close()
        except Exception: pass

def get_db():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set")
    pool = _get_pool()
    for attempt in range(2):
        conn = pool.getconn()
        idle = time.time() - _last_used.get(id(conn), 0)
        if not conn.closed and idle > 60:
            # Connections idle for a while may have been dropped by the pooler; check cheaply
            try:
                with conn.cursor() as c: c.execute("SELECT 1")
                conn.rollback()
            except Exception:
                _last_used.pop(id(conn), None)
                pool.putconn(conn, close=True)
                continue
        if conn.closed:
            pool.putconn(conn, close=True)
            continue
        _last_used[id(conn)] = time.time()
        return _PooledConn(pool, conn)
    return _PooledConn(pool, pool.getconn())

# ── Auth ────────────────────────────────────────────────────────────────────
# supabase.auth.get_user() is a network call to Supabase on every request.
# Cache the answer per token for a minute.
_user_cache = {}
_USER_TTL = 60

def get_current_user():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        token = session.get("access_token", "")
    if not token:
        return None
    now = time.time()
    hit = _user_cache.get(token)
    if hit and hit[1] > now:
        return hit[0]
    try:
        user = supabase.auth.get_user(token)
        user = user.user if user else None
    except Exception:
        user = None
    if user:
        if len(_user_cache) > 5000:
            for k in [k for k, v in _user_cache.items() if v[1] <= now]:
                _user_cache.pop(k, None)
        _user_cache[token] = (user, now + _USER_TTL)
    return user

def get_profile(user_id):
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT * FROM profiles WHERE id = %s", (str(user_id),))
    p = cur.fetchone(); conn.close()
    return p

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, user=user, **kwargs)
    return decorated

def require_landlord(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        p = get_profile(user.id)
        if not p or p["role"] not in ("landlord", "admin"):
            return jsonify({"error": "Landlord account required"}), 403
        return f(*args, user=user, **kwargs)
    return decorated

def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        if user.email != ADMIN_EMAIL:
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, user=user, **kwargs)
    return decorated

# ── Security headers ─────────────────────────────────────────────────────────
_supabase_origin = (SUPABASE_URL or "").rstrip("/")
CSP = "; ".join([
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",   # the UI uses inline onclick handlers
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    f"img-src 'self' data: blob: {_supabase_origin}",
    f"media-src 'self' blob: {_supabase_origin}",
    f"connect-src 'self' {_supabase_origin}",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
])

@app.after_request
def security_headers(resp):
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    resp.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if request.is_secure or request.headers.get("X-Forwarded-Proto") == "https":
        resp.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    if resp.mimetype == "text/html":
        resp.headers.setdefault("Content-Security-Policy", CSP)
    if request.path.startswith("/api/") and "Cache-Control" not in resp.headers:
        resp.headers["Cache-Control"] = "no-store"   # don't let shared caches keep personal data
    return resp

# Fields tenants pay to see, or that are nobody else's business, never go out in public listing data
PRIVATE_LISTING_FIELDS = ("street_address", "landlord_id", "landlord_profile_id")
def _public_listing(row):
    d = dict(row)
    for k in PRIVATE_LISTING_FIELDS:
        d.pop(k, None)
    return d

# ── Page routes ──────────────────────────────────────────────────────────────
@app.route("/")
@app.route("/<path:path>")
def index(path=""):
    return render_template("index.html", v=ASSET_VERSION)

# ── AUTH ─────────────────────────────────────────────────────────────────────
@app.route("/api/auth/register", methods=["POST"])
def register():
    data     = request.json
    email    = data.get("email","").strip().lower()
    password = data.get("password","")
    name     = data.get("full_name","").strip()
    role     = data.get("role","tenant")
    phone    = data.get("phone","").strip()
    id_number= data.get("id_number","").strip()
    location = data.get("location","").strip()

    if not email or not password or not name:
        return jsonify({"error":"Email, password and name are required"}), 400
    if role not in ("tenant","landlord"):
        return jsonify({"error":"Invalid role"}), 400
    if len(password) < 6:
        return jsonify({"error":"Use at least 6 characters for your password"}), 400
    if _rate_limited(f"register:{_client_ip()}", 10, 3600):
        return jsonify({"error":"Too many sign-ups from this network. Try again later."}), 429

    # Admin email always gets admin role
    if email == ADMIN_EMAIL:
        role = "admin"

    try:
        res = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {"data": {"full_name": name, "role": role}}
        })
        if not res.user:
            return jsonify({"error":"Registration failed"}), 400

        uid = str(res.user.id)
        conn = get_db(); cur = conn.cursor()
        cur.execute("""
            UPDATE profiles SET phone=%s, id_number=%s, location=%s, role=%s
            WHERE id=%s
        """, (phone, id_number, location, role, uid))
        conn.commit(); conn.close()

        return jsonify({"message":"Registration successful. Check your email to confirm."}), 201
    except Exception as e:
        msg = str(e)
        if "already registered" in msg.lower():
            return jsonify({"error":"Email already registered"}), 409
        return jsonify({"error": msg}), 400

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json
    email    = data.get("email","").strip().lower()
    password = data.get("password","")
    if not email or not password:
        return jsonify({"error":"Email and password required"}), 400
    if _rate_limited(f"login:{_client_ip()}", 20, 600) or _rate_limited(f"login-email:{email}", 8, 600):
        return jsonify({"error":"Too many attempts. Wait 10 minutes and try again."}), 429
    try:
        res = supabase.auth.sign_in_with_password({"email": email, "password": password})
        if not res.user or not res.session:
            return jsonify({"error":"Invalid credentials"}), 401

        p = get_profile(res.user.id)
        role = p["role"] if p else "tenant"

        # Promote admin email automatically
        if email == ADMIN_EMAIL and role != "admin":
            conn = get_db(); cur = conn.cursor()
            cur.execute("UPDATE profiles SET role='admin' WHERE id=%s", (str(res.user.id),))
            conn.commit(); conn.close()
            role = "admin"

        return jsonify({
            "access_token":  res.session.access_token,
            "refresh_token": res.session.refresh_token,
            "user": {
                "id":         str(res.user.id),
                "email":      res.user.email,
                "full_name":  p["full_name"]  if p else "",
                "role":       role,
                "phone":      p["phone"]      if p else "",
                "id_number":  p["id_number"]  if p else "",
                "location":   p["location"]   if p else "",
                "avatar_url": p["avatar_url"] if p else "",
                "is_admin":   email == ADMIN_EMAIL
            }
        }), 200
    except Exception:
        return jsonify({"error":"Invalid email or password"}), 401

@app.route("/api/auth/logout", methods=["POST"])
def logout():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    _user_cache.pop(token, None)
    try: supabase.auth.sign_out()
    except: pass
    session.clear()
    return jsonify({"message":"Logged out"}), 200

@app.route("/api/auth/me", methods=["GET"])
@require_auth
def me(user):
    p = get_profile(user.id)
    return jsonify({
        "id":         str(user.id),
        "email":      user.email,
        "full_name":  p["full_name"]  if p else "",
        "role":       p["role"]       if p else "tenant",
        "phone":      p["phone"]      if p else "",
        "id_number":  p["id_number"]  if p else "",
        "location":   p["location"]   if p else "",
        "avatar_url": p["avatar_url"] if p else "",
        "is_verified":p["is_verified"]if p else False,
        "is_admin":   user.email == ADMIN_EMAIL
    }), 200

@app.route("/api/auth/profile", methods=["PUT"])
@require_auth
def update_profile(user):
    data = request.json
    allowed = ["full_name","phone","id_number","location"]
    updates = {k: data[k] for k in allowed if k in data}
    if not updates:
        return jsonify({"error":"Nothing to update"}), 400
    conn = get_db(); cur = conn.cursor()
    set_clause = ", ".join(f"{k}=%s" for k in updates)
    cur.execute(f"UPDATE profiles SET {set_clause} WHERE id=%s",
                list(updates.values()) + [str(user.id)])
    conn.commit(); conn.close()
    return jsonify({"message":"Profile updated"}), 200

# ── COUNTIES & AREAS ──────────────────────────────────────────────────────────
@app.route("/api/counties")
def get_counties():
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        SELECT c.*, COUNT(l.id) AS listing_count
        FROM counties c
        LEFT JOIN listings l ON l.county_id=c.id AND l.status='active'
        GROUP BY c.id ORDER BY c.region, c.name
    """)
    rows = cur.fetchall(); conn.close()
    resp = jsonify([dict(r) for r in rows])
    resp.headers["Cache-Control"] = "public, max-age=300"
    return resp, 200

@app.route("/api/counties/<slug>")
def get_county(slug):
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT * FROM counties WHERE slug=%s", (slug,))
    c = cur.fetchone()
    if not c: conn.close(); return jsonify({"error":"Not found"}), 404
    cur.execute("SELECT * FROM areas WHERE county_id=%s ORDER BY name", (c["id"],))
    areas = cur.fetchall(); conn.close()
    return jsonify({"county": dict(c), "areas": [dict(a) for a in areas]}), 200

@app.route("/api/areas")
def get_areas():
    cid = request.args.get("county_id")
    conn = get_db(); cur = conn.cursor()
    if cid:
        cur.execute("SELECT * FROM areas WHERE county_id=%s ORDER BY name", (cid,))
    else:
        cur.execute("SELECT a.*,c.name as county_name FROM areas a JOIN counties c ON c.id=a.county_id ORDER BY c.name,a.name")
    rows = cur.fetchall(); conn.close()
    resp = jsonify([dict(r) for r in rows])
    resp.headers["Cache-Control"] = "public, max-age=3600"
    return resp, 200

# ── LISTINGS ──────────────────────────────────────────────────────────────────
@app.route("/api/listings")
def get_listings():
    q           = request.args.get("q","").strip()
    county_slug = request.args.get("county","")
    area_id     = request.args.get("area_id","")
    prop_type   = request.args.get("type","")
    min_price   = request.args.get("min_price","")
    max_price   = request.args.get("max_price","")
    sort        = request.args.get("sort","newest")
    try:
        page     = max(1, int(request.args.get("page",1)))
        per_page = max(1, min(20, int(request.args.get("per_page",12))))
    except ValueError:
        return jsonify({"error":"Bad page number"}), 400
    amenities   = {
        "has_water":      request.args.get("water"),
        "has_parking":    request.args.get("parking"),
        "has_wifi":       request.args.get("wifi"),
        "has_security":   request.args.get("security"),
        "is_furnished":   request.args.get("furnished"),
        "has_dsq":        request.args.get("dsq"),
        "has_gym":        request.args.get("gym"),
        "has_cctv":       request.args.get("cctv"),
        "has_borehole":   request.args.get("borehole"),
        "has_generator":  request.args.get("generator"),
        "is_pet_friendly":request.args.get("pet_friendly"),
        "has_pool":       request.args.get("pool"),
    }
    conds  = ["l.status='active'"]
    params = []

    if q:
        conds.append("(l.title ILIKE %s OR l.description ILIKE %s OR l.street_address ILIKE %s OR a.name ILIKE %s OR c.name ILIKE %s)")
        lk = f"%{q}%"
        params += [lk,lk,lk,lk,lk]
    if county_slug:
        conds.append("c.slug=%s"); params.append(county_slug)
    if area_id:
        conds.append("l.area_id=%s"); params.append(area_id)
    if prop_type:
        conds.append("l.property_type=%s"); params.append(prop_type)
    if min_price.isdigit():
        conds.append("l.monthly_rent>=%s"); params.append(int(min_price))
    if max_price.isdigit():
        conds.append("l.monthly_rent<=%s"); params.append(int(max_price))
    for col,val in amenities.items():
        if val=="true":
            conds.append(f"l.{col}=TRUE")

    order_map = {
        "newest":"l.created_at DESC","oldest":"l.created_at ASC",
        "price_asc":"l.monthly_rent ASC","price_desc":"l.monthly_rent DESC",
        "rating":"l.average_rating DESC","popular":"l.unlock_count DESC"
    }
    order_by = order_map.get(sort,"l.created_at DESC")
    where  = " AND ".join(conds)
    offset = (page-1)*per_page

    conn = get_db(); cur = conn.cursor()
    # One round trip: COUNT(*) OVER() gives the total alongside the page of rows.
    # Landlord phone is left out on purpose: it's what tenants pay to unlock.
    cur.execute(f"""
        SELECT l.*, c.name AS county_name, c.slug AS county_slug,
               a.name AS area_name,
               (SELECT url FROM listing_media WHERE listing_id=l.id AND media_type='photo' ORDER BY sort_order LIMIT 1) AS cover_photo,
               COUNT(*) OVER() AS _total
        FROM listings l
        JOIN counties c ON c.id=l.county_id
        LEFT JOIN areas a ON a.id=l.area_id
        WHERE {where}
        ORDER BY l.is_featured DESC, {order_by}
        LIMIT %s OFFSET %s
    """, params+[per_page, offset])
    listings = [_public_listing(l) for l in cur.fetchall()]
    if listings:
        total = listings[0]["_total"]
    elif page > 1:
        cur.execute(f"""
            SELECT COUNT(*) FROM listings l
            JOIN counties c ON c.id=l.county_id
            LEFT JOIN areas a ON a.id=l.area_id
            WHERE {where}
        """, params)
        total = cur.fetchone()["count"]
    else:
        total = 0
    for l in listings:
        l.pop("_total", None)
    conn.close()
    return jsonify({"listings":listings,"total":total,"page":page,"per_page":per_page,"pages":max(1, -(-total//per_page))}), 200

@app.route("/api/listings/<listing_id>")
def get_listing(listing_id):
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        SELECT l.*, c.name AS county_name, c.slug AS county_slug,
               a.name AS area_name, a.slug AS area_slug,
               p.avatar_url AS landlord_avatar, p.is_verified AS landlord_verified,
               p.id AS landlord_profile_id
        FROM listings l
        JOIN counties c ON c.id=l.county_id
        LEFT JOIN areas a ON a.id=l.area_id
        LEFT JOIN profiles p ON p.id=l.landlord_id
        WHERE l.id=%s AND l.status='active'
    """, (listing_id,))
    listing = cur.fetchone()
    if not listing: conn.close(); return jsonify({"error":"Not found"}), 404
    cur.execute("SELECT * FROM listing_media WHERE listing_id=%s ORDER BY sort_order", (listing_id,))
    media = cur.fetchall()
    cur.execute("""
        SELECT r.*, split_part(COALESCE(p.full_name,'Tenant'), ' ', 1) AS reviewer_name
        FROM reviews r JOIN profiles p ON p.id=r.tenant_id
        WHERE r.listing_id=%s ORDER BY r.created_at DESC LIMIT 10
    """, (listing_id,))
    reviews = cur.fetchall()
    cur.execute("UPDATE listings SET views=views+1 WHERE id=%s", (listing_id,))
    conn.commit(); conn.close()
    media = [{k: m[k] for k in ("id", "media_type", "url", "sort_order") if k in m} for m in media]
    reviews = [{k: r[k] for k in ("id", "rating", "comment", "created_at", "reviewer_name") if k in r} for r in reviews]
    return jsonify({"listing":_public_listing(listing),"media":media,"reviews":reviews}), 200

@app.route("/api/listings", methods=["POST"])
@require_landlord
def create_listing(user):
    data = request.json
    for f in ["title","county_id","property_type","monthly_rent"]:
        if not data.get(f): return jsonify({"error":f"{f} is required"}), 400

    lid = str(uuid.uuid4())
    af  = ["has_water","has_borehole","has_security","has_cctv","has_parking","has_wifi",
           "has_electricity_token","has_generator","is_furnished","has_dsq","has_garbage",
           "has_caretaker","has_gym","has_pool","has_playground","is_pet_friendly",
           "has_balcony","has_lift","near_school","near_hospital","near_market",
           "near_matatu","near_church","near_water_kiosk"]

    conn = get_db(); cur = conn.cursor()
    cur.execute(f"""
        INSERT INTO listings (id,landlord_id,county_id,area_id,title,description,
          property_type,floor,monthly_rent,deposit_months,street_address,
          {','.join(af)},status)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,{','.join(['%s']*len(af))},'active')
        RETURNING id
    """, (lid, str(user.id), data.get("county_id"), data.get("area_id"),
          data["title"], data.get("description"), data["property_type"],
          data.get("floor"), int(data["monthly_rent"]), int(data.get("deposit_months",2)),
          data.get("street_address"), *[bool(data.get(f,False)) for f in af]))
    result = cur.fetchone(); conn.commit(); conn.close()
    return jsonify({"listing_id":str(result["id"]),"message":"Listing created"}), 201

@app.route("/api/listings/<listing_id>", methods=["PUT"])
@require_auth
def update_listing(user, listing_id):
    data = request.json
    p    = get_profile(user.id)
    if not p: return jsonify({"error":"Profile not found"}), 403
    is_admin = (user.email == ADMIN_EMAIL)   # only the configured admin email, never a role someone could set

    conn = get_db(); cur = conn.cursor()
    if is_admin:
        cur.execute("SELECT id FROM listings WHERE id=%s", (listing_id,))
    else:
        if p["role"] not in ("landlord",):
            conn.close(); return jsonify({"error":"Not authorized"}), 403
        cur.execute("SELECT id FROM listings WHERE id=%s AND landlord_id=%s", (listing_id, str(user.id)))
    if not cur.fetchone(): conn.close(); return jsonify({"error":"Not found"}), 404

    updatable = ["title","description","property_type","floor","monthly_rent","deposit_months",
                 "street_address","county_id","area_id","status","has_water","has_borehole",
                 "has_security","has_cctv","has_parking","has_wifi","has_electricity_token",
                 "has_generator","is_furnished","has_dsq","has_garbage","has_caretaker",
                 "has_gym","has_pool","has_playground","is_pet_friendly","has_balcony",
                 "has_lift","near_school","near_hospital","near_market","near_matatu",
                 "near_church","near_water_kiosk"]
    updates = {k: data[k] for k in updatable if k in data}
    if "status" in updates and updates["status"] not in (("active","inactive","pending") if is_admin else ("active","inactive")):
        conn.close(); return jsonify({"error":"Invalid status"}), 400
    try:
        for k in ("monthly_rent","deposit_months"):
            if k in updates: updates[k] = int(updates[k])
    except (TypeError, ValueError):
        conn.close(); return jsonify({"error":"Rent and deposit must be numbers"}), 400
    if not updates: conn.close(); return jsonify({"error":"Nothing to update"}), 400
    set_clause = ", ".join(f"{k}=%s" for k in updates)
    cur.execute(f"UPDATE listings SET {set_clause} WHERE id=%s", list(updates.values())+[listing_id])
    conn.commit(); conn.close()
    return jsonify({"message":"Updated"}), 200

@app.route("/api/listings/<listing_id>", methods=["DELETE"])
@require_auth
def delete_listing(user, listing_id):
    p        = get_profile(user.id)
    is_admin = (user.email == ADMIN_EMAIL)
    conn = get_db(); cur = conn.cursor()
    if is_admin:
        cur.execute("DELETE FROM listings WHERE id=%s RETURNING id", (listing_id,))
    else:
        cur.execute("DELETE FROM listings WHERE id=%s AND landlord_id=%s RETURNING id",
                    (listing_id, str(user.id)))
    deleted = cur.fetchone(); conn.commit(); conn.close()
    if not deleted: return jsonify({"error":"Not found or not authorized"}), 404
    return jsonify({"message":"Deleted"}), 200

# ── LANDLORD DASHBOARD ────────────────────────────────────────────────────────
@app.route("/api/landlord/listings")
@require_landlord
def landlord_listings(user):
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        SELECT l.*, c.name AS county_name, a.name AS area_name,
               (SELECT COUNT(*) FROM listing_media WHERE listing_id=l.id AND media_type='photo') AS photo_count,
               (SELECT COUNT(*) FROM listing_media WHERE listing_id=l.id AND media_type='video') AS video_count,
               (SELECT url FROM listing_media WHERE listing_id=l.id AND media_type='photo' ORDER BY sort_order LIMIT 1) AS cover_photo
        FROM listings l
        JOIN counties c ON c.id=l.county_id
        LEFT JOIN areas a ON a.id=l.area_id
        WHERE l.landlord_id=%s ORDER BY l.created_at DESC
    """, (str(user.id),))
    listings = cur.fetchall()
    cur.execute("""
        SELECT COUNT(*) FILTER (WHERE status='active') AS active,
               COUNT(*) FILTER (WHERE status='pending') AS pending,
               COALESCE(SUM(views),0) AS total_views,
               COALESCE(SUM(unlock_count),0) AS total_unlocks
        FROM listings WHERE landlord_id=%s
    """, (str(user.id),))
    stats = cur.fetchone(); conn.close()
    return jsonify({"listings":[dict(l) for l in listings],"stats":dict(stats) if stats else {}}), 200

# ── ADMIN ROUTES ──────────────────────────────────────────────────────────────
@app.route("/api/admin/listings")
@require_admin
def admin_listings(user):
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        SELECT l.*, c.name AS county_name, a.name AS area_name,
               p.full_name AS landlord_name, p.phone AS landlord_phone,
               p.email AS landlord_email, p.id_number AS landlord_id_number,
               p.location AS landlord_location,
               (SELECT url FROM listing_media WHERE listing_id=l.id AND media_type='photo' ORDER BY sort_order LIMIT 1) AS cover_photo
        FROM listings l
        JOIN counties c ON c.id=l.county_id
        LEFT JOIN areas a ON a.id=l.area_id
        LEFT JOIN profiles p ON p.id=l.landlord_id
        ORDER BY l.created_at DESC
    """)
    listings = cur.fetchall(); conn.close()
    return jsonify([dict(l) for l in listings]), 200

@app.route("/api/admin/landlords")
@require_admin
def admin_landlords(user):
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        SELECT p.*, au.email,
               COUNT(l.id) AS listing_count,
               COALESCE(SUM(l.views),0) AS total_views,
               COALESCE(SUM(l.unlock_count),0) AS total_unlocks,
               COUNT(l.id) FILTER (WHERE l.status='active') AS active_listings,
               COUNT(l.id) FILTER (WHERE l.status='inactive') AS inactive_listings
        FROM profiles p
        JOIN auth.users au ON au.id=p.id
        LEFT JOIN listings l ON l.landlord_id=p.id
        WHERE p.role='landlord'
        GROUP BY p.id, au.email
        ORDER BY p.created_at DESC
    """)
    landlords = cur.fetchall(); conn.close()
    return jsonify([dict(l) for l in landlords]), 200

@app.route("/api/admin/landlords/<landlord_id>")
@require_admin
def admin_landlord_detail(user, landlord_id):
    """Get one landlord's profile + all their listings"""
    conn = get_db(); cur = conn.cursor()
    # Profile
    cur.execute("""
        SELECT p.*, au.email
        FROM profiles p
        JOIN auth.users au ON au.id=p.id
        WHERE p.id=%s
    """, (landlord_id,))
    profile = cur.fetchone()
    if not profile: conn.close(); return jsonify({"error":"Landlord not found"}), 404
    # All their listings (all statuses)
    cur.execute("""
        SELECT l.*, c.name AS county_name, c.slug AS county_slug,
               a.name AS area_name,
               (SELECT COUNT(*) FROM listing_media WHERE listing_id=l.id AND media_type='photo') AS photo_count,
               (SELECT url FROM listing_media WHERE listing_id=l.id AND media_type='photo' ORDER BY sort_order LIMIT 1) AS cover_photo
        FROM listings l
        JOIN counties c ON c.id=l.county_id
        LEFT JOIN areas a ON a.id=l.area_id
        WHERE l.landlord_id=%s
        ORDER BY l.created_at DESC
    """, (landlord_id,))
    listings = cur.fetchall()
    conn.close()
    return jsonify({"profile": dict(profile), "listings": [dict(l) for l in listings]}), 200

@app.route("/api/admin/landlords/<landlord_id>/suspend", methods=["POST"])
@require_admin
def admin_suspend_landlord(user, landlord_id):
    """Suspend landlord — deactivates all their listings"""
    conn = get_db(); cur = conn.cursor()
    cur.execute("UPDATE listings SET status='inactive' WHERE landlord_id=%s RETURNING id", (landlord_id,))
    count = len(cur.fetchall())
    conn.commit(); conn.close()
    return jsonify({"message": f"Suspended landlord. {count} listings deactivated."}), 200

@app.route("/api/admin/landlords/<landlord_id>/restore", methods=["POST"])
@require_admin
def admin_restore_landlord(user, landlord_id):
    """Restore landlord — reactivates all their listings"""
    conn = get_db(); cur = conn.cursor()
    cur.execute("UPDATE listings SET status='active' WHERE landlord_id=%s RETURNING id", (landlord_id,))
    count = len(cur.fetchall())
    conn.commit(); conn.close()
    return jsonify({"message": f"Restored landlord. {count} listings reactivated."}), 200

@app.route("/api/admin/stats")
@require_admin
def admin_stats(user):
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        SELECT
          (SELECT COUNT(*) FROM listings WHERE status='active') AS active_listings,
          (SELECT COUNT(*) FROM listings) AS total_listings,
          (SELECT COUNT(*) FROM profiles WHERE role='landlord') AS landlords,
          (SELECT COUNT(*) FROM profiles WHERE role='tenant') AS tenants,
          (SELECT COUNT(*) FROM unlocks WHERE status='completed') AS total_unlocks
    """)
    stats = cur.fetchone(); conn.close()
    return jsonify(dict(stats) if stats else {}), 200

# ── MEDIA ────────────────────────────────────────────────────────────────────
MEDIA_BUCKET = "listing-media"
PHOTO_EXTS = {"jpg", "jpeg", "png", "webp", "heic", "heif", "gif"}
VIDEO_EXTS = {"mp4", "mov", "m4v", "webm", "3gp"}

def _can_edit_listing(cur, user, listing_id):
    """Owner, or the admin, may change a listing's media."""
    if user.email == ADMIN_EMAIL:
        cur.execute("SELECT id FROM listings WHERE id=%s", (listing_id,))
    else:
        cur.execute("SELECT id FROM listings WHERE id=%s AND landlord_id=%s", (listing_id, str(user.id)))
    return cur.fetchone() is not None

def _media_mime(ext, media_type):
    guessed = mimetypes.types_map.get("." + ext)
    if guessed:
        return guessed
    return {"jpg": "image/jpeg", "heic": "image/heic", "heif": "image/heif", "webp": "image/webp",
            "mov": "video/quicktime", "m4v": "video/mp4", "3gp": "video/3gpp"}.get(
        ext, "image/jpeg" if media_type == "photo" else "video/mp4")

def _public_url(path):
    return f"{SUPABASE_URL}/storage/v1/object/public/{MEDIA_BUCKET}/{path}"

def _insert_media(cur, listing_id, media_type, url, path, sort_order):
    if sort_order is None:
        cur.execute("""
            INSERT INTO listing_media (listing_id,media_type,url,storage_path,sort_order)
            VALUES (%s,%s,%s,%s,(SELECT COALESCE(MAX(sort_order)+1,0) FROM listing_media WHERE listing_id=%s))
            RETURNING id,url
        """, (listing_id, media_type, url, path, listing_id))
    else:
        cur.execute("""
            INSERT INTO listing_media (listing_id,media_type,url,storage_path,sort_order)
            VALUES (%s,%s,%s,%s,%s) RETURNING id,url
        """, (listing_id, media_type, url, path, int(sort_order)))
    return cur.fetchone()

@app.route("/api/listings/<listing_id>/media/sign", methods=["POST"])
@require_landlord
def sign_media_upload(user, listing_id):
    """Step 1 of a direct upload: hand the browser a short-lived signed URL so the
    file goes straight to Supabase Storage instead of through this server."""
    data = request.json or {}
    media_type = "video" if data.get("media_type") == "video" else "photo"
    ext = str(data.get("ext", "")).lower().strip(".")[:5]
    allowed = VIDEO_EXTS if media_type == "video" else PHOTO_EXTS
    if ext not in allowed:
        return jsonify({"error": f"That file type isn't supported. Use {', '.join(sorted(allowed))}."}), 400
    conn = get_db(); cur = conn.cursor()
    ok = _can_edit_listing(cur, user, listing_id); conn.close()
    if not ok:
        return jsonify({"error": "Not found"}), 404
    path = f"{listing_id}/{uuid.uuid4()}.{ext}"
    try:
        r = requests.post(
            f"{SUPABASE_URL}/storage/v1/object/upload/sign/{MEDIA_BUCKET}/{path}",
            headers={"Authorization": f"Bearer {SUPABASE_SERVICE_KEY}", "apikey": SUPABASE_SERVICE_KEY,
                     "Content-Type": "application/json"},
            json={}, timeout=10)
        body = r.json() if r.content else {}
        signed = body.get("url")
        if r.status_code >= 300 or not signed:
            return jsonify({"error": body.get("message") or "Storage refused the upload"}), 502
    except Exception as e:
        return jsonify({"error": f"Storage unavailable: {e}"}), 502
    return jsonify({
        "path": path,
        "upload_url": f"{SUPABASE_URL}/storage/v1{signed}",
        "public_url": _public_url(path),
    }), 200

@app.route("/api/listings/<listing_id>/media/confirm", methods=["POST"])
@require_landlord
def confirm_media_upload(user, listing_id):
    """Step 2 of a direct upload: record the file once the browser has uploaded it."""
    data = request.json or {}
    path = str(data.get("path", ""))
    media_type = "video" if data.get("media_type") == "video" else "photo"
    if not path.startswith(f"{listing_id}/") or ".." in path:
        return jsonify({"error": "Invalid file path"}), 400
    conn = get_db(); cur = conn.cursor()
    if not _can_edit_listing(cur, user, listing_id):
        conn.close(); return jsonify({"error": "Not found"}), 404
    media = _insert_media(cur, listing_id, media_type, _public_url(path), path, data.get("sort_order"))
    conn.commit(); conn.close()
    return jsonify({"id": str(media["id"]), "url": media["url"]}), 201

@app.route("/api/listings/<listing_id>/media", methods=["POST"])
@require_landlord
def upload_media(user, listing_id):
    """Fallback upload through this server (used if direct upload isn't available)."""
    conn = get_db(); cur = conn.cursor()
    if not _can_edit_listing(cur, user, listing_id): conn.close(); return jsonify({"error":"Not found"}), 404
    if "file" not in request.files: conn.close(); return jsonify({"error":"No file"}), 400

    file       = request.files["file"]
    media_type = "video" if request.form.get("media_type") == "video" else "photo"
    ext        = (file.filename.rsplit(".",1)[-1].lower() if "." in (file.filename or "") else "")[:5] or ("mp4" if media_type == "video" else "jpg")
    filename   = f"{listing_id}/{uuid.uuid4()}.{ext}"
    file_bytes = file.read()
    mime       = file.mimetype if file.mimetype and file.mimetype != "application/octet-stream" else _media_mime(ext, media_type)

    try:
        supabase_admin.storage.from_(MEDIA_BUCKET).upload(filename, file_bytes, {"content-type": mime})
    except Exception as e:
        print("UPLOAD ERROR:", e)
        conn.close(); return jsonify({"error":"Storage didn't accept the file. Try again."}), 500

    media = _insert_media(cur, listing_id, media_type, _public_url(filename), filename, request.form.get("sort_order"))
    conn.commit(); conn.close()
    return jsonify({"id":str(media["id"]),"url":media["url"]}), 201

@app.route("/api/landlord/listings/<listing_id>")
@require_landlord
def landlord_listing_detail(user, listing_id):
    """A landlord's own listing with its media, whatever its status (for the edit page)."""
    conn = get_db(); cur = conn.cursor()
    if not _can_edit_listing(cur, user, listing_id):
        conn.close(); return jsonify({"error": "Not found"}), 404
    cur.execute("""
        SELECT l.*, c.name AS county_name, c.slug AS county_slug, a.name AS area_name
        FROM listings l JOIN counties c ON c.id=l.county_id LEFT JOIN areas a ON a.id=l.area_id
        WHERE l.id=%s
    """, (listing_id,))
    listing = cur.fetchone()
    cur.execute("SELECT * FROM listing_media WHERE listing_id=%s ORDER BY sort_order", (listing_id,))
    media = cur.fetchall(); conn.close()
    return jsonify({"listing": dict(listing), "media": [dict(m) for m in media]}), 200

@app.route("/api/listings/<listing_id>/media/<media_id>", methods=["DELETE"])
@require_landlord
def delete_media(user, listing_id, media_id):
    conn = get_db(); cur = conn.cursor()
    if not _can_edit_listing(cur, user, listing_id):
        conn.close(); return jsonify({"error": "Not found"}), 404
    cur.execute("""
        DELETE FROM listing_media WHERE id=%s AND listing_id=%s
        RETURNING storage_path
    """, (media_id, listing_id))
    deleted = cur.fetchone(); conn.commit(); conn.close()
    if deleted and deleted["storage_path"]:
        try: supabase_admin.storage.from_(MEDIA_BUCKET).remove([deleted["storage_path"]])
        except: pass
    return jsonify({"message":"Deleted"}), 200

# ── UNLOCKS ───────────────────────────────────────────────────────────────────
# Payment flow (PayHero STK push):
#   1. initiate_unlock creates a 'pending' row and asks PayHero to push a prompt.
#      The callback URL carries u=<unlock id>&t=<signature>, so a callback can be
#      tied to its row and nobody can forge one without knowing the signature.
#   2. mpesa_callback never trusts the request body on its own. A payment only
#      counts if the signature in the URL is valid, or PayHero's own
#      transaction-status API confirms it.
#   3. unlock_status (polled by the browser) also asks PayHero directly while a
#      payment is pending, so a lost callback doesn't leave a paying tenant stuck.
PAYHERO_STATUS_URL = "https://backend.payhero.co.ke/api/v2/transaction-status"
PAYHERO_VERIFY     = os.getenv("PAYHERO_VERIFY", "true").lower() != "false"
UNLOCK_PRICE       = 500
_CALLBACK_SECRET   = (os.getenv("PAYHERO_CALLBACK_SECRET") or SUPABASE_SERVICE_KEY or app.secret_key or "").encode()

def _callback_sig(unlock_id):
    return hmac.new(_CALLBACK_SECRET, f"unlock:{unlock_id}".encode(), hashlib.sha256).hexdigest()[:32]

def _callback_url_for(unlock_id):
    sep = "&" if "?" in PAYHERO_CALLBACK else "?"
    return f"{PAYHERO_CALLBACK}{sep}u={unlock_id}&t={_callback_sig(unlock_id)}"

def _payhero_status(reference):
    """Ask PayHero what happened to a payment. Returns 'success', 'failed', 'pending' or None (couldn't tell)."""
    if not reference or PAYHERO_USERNAME == "placeholder":
        return None
    try:
        r = requests.get(PAYHERO_STATUS_URL, params={"reference": reference}, headers=payhero_auth(), timeout=8)
        data = r.json() if r.content else {}
    except Exception as e:
        print("PAYHERO STATUS CHECK FAILED:", e)
        return None
    status = str(data.get("status", "")).upper()
    if status == "SUCCESS":
        return "success"
    if status in ("FAILED", "CANCELLED", "CANCELED", "REVERSED"):
        return "failed"
    if status in ("QUEUED", "PENDING", "PROCESSING"):
        return "pending"
    return None

def _complete_unlock(cur, unlock_id, receipt):
    cur.execute("""
        UPDATE unlocks SET status='completed', mpesa_receipt_number=%s, completed_at=NOW()
        WHERE id=%s AND status <> 'completed'
        RETURNING listing_id
    """, (receipt or None, unlock_id))
    row = cur.fetchone()
    if row:
        cur.execute("UPDATE listings SET unlock_count=COALESCE(unlock_count,0)+1 WHERE id=%s", (row["listing_id"],))
    return bool(row)

# Simple per-process rate limiter (stops STK-push spam and password guessing)
_rate = {}
_rate_lock = threading.Lock()
def _rate_limited(key, limit, window):
    now = time.time()
    with _rate_lock:
        hits = [t for t in _rate.get(key, []) if t > now - window]
        if len(hits) >= limit:
            _rate[key] = hits
            return True
        hits.append(now)
        _rate[key] = hits
        if len(_rate) > 20000:
            for k in [k for k, v in _rate.items() if not v or v[-1] < now - 3600]:
                _rate.pop(k, None)
    return False

def _client_ip():
    fwd = request.headers.get("X-Forwarded-For", "")
    return (fwd.split(",")[0].strip() if fwd else request.remote_addr) or "?"

@app.route("/api/unlock/initiate", methods=["POST"])
@require_auth
def initiate_unlock(user):
    data       = request.json or {}
    listing_id = data.get("listing_id")
    phone      = str(data.get("phone","")).replace(" ","").replace("+","").replace("-","")
    if not listing_id or not phone:
        return jsonify({"error":"listing_id and phone required"}), 400
    if phone.startswith("0"): phone = "254"+phone[1:]
    if not phone.startswith("254"): phone = "254"+phone
    if not re.fullmatch(r"254[17]\d{8}", phone):
        return jsonify({"error":"Enter a Safaricom number like 0712 345 678."}), 400
    if _rate_limited(f"stk:{user.id}", 5, 600) or _rate_limited(f"stk-phone:{phone}", 5, 600):
        return jsonify({"error":"Too many payment requests. Wait a few minutes and try again."}), 429

    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT id,status FROM unlocks WHERE tenant_id=%s AND listing_id=%s", (str(user.id), listing_id))
    existing = cur.fetchone()
    if existing and existing["status"]=="completed":
        conn.close(); return jsonify({"error":"Already unlocked","already_unlocked":True}), 409
    cur.execute("SELECT id, landlord_id FROM listings WHERE id=%s AND status='active'", (listing_id,))
    listing = cur.fetchone()
    if not listing: conn.close(); return jsonify({"error":"Listing not found"}), 404
    if str(listing["landlord_id"]) == str(user.id):
        conn.close(); return jsonify({"error":"This is your own listing."}), 400

    uid = str(uuid.uuid4())
    cur.execute("""
        INSERT INTO unlocks (id,tenant_id,listing_id,phone,status)
        VALUES (%s,%s,%s,%s,'pending')
        ON CONFLICT (tenant_id,listing_id) DO UPDATE SET phone=%s,status='pending'
        RETURNING id
    """, (uid, str(user.id), listing_id, phone, phone))
    unlock = cur.fetchone(); conn.commit()
    unlock_id = str(unlock["id"])

    # ── PayHero STK Push ──────────────────────────────────────────────────────
    try:
        resp = requests.post(
            PAYHERO_STK_URL,
            json={
                "amount":             UNLOCK_PRICE,
                "phone_number":       phone,
                "channel_id":         PAYHERO_CHANNEL_ID,
                "provider":           "m-pesa",
                "external_reference": f"MyNyumba-{unlock_id[:8]}",
                "callback_url":       _callback_url_for(unlock_id),
            },
            headers=payhero_auth(),
            timeout=15
        )
        data        = resp.json() if resp.content else {}
        checkout_id = data.get("reference") or data.get("CheckoutRequestID", "")
        if resp.status_code >= 300 or not checkout_id:
            print("PAYHERO INITIATE REFUSED:", resp.status_code, data)
            conn.close()
            return jsonify({"error": "M-Pesa didn't accept the request. Check the number and try again."}), 502
        cur.execute("UPDATE unlocks SET mpesa_checkout_request_id=%s WHERE id=%s", (checkout_id, unlock_id))
        conn.commit(); conn.close()
        return jsonify({"message": "STK Push sent. Enter your M-Pesa PIN."}), 200
    except Exception as e:
        print("PAYHERO INITIATE ERROR:", e)
        conn.close()
        return jsonify({"error": "We couldn't reach M-Pesa. Try again in a minute."}), 502

@app.route("/api/mpesa/callback", methods=["POST"])
def mpesa_callback():
    conn = None
    try:
        data     = request.get_json(silent=True) or {}
        response = data.get("response") or {}
        merchant_request_id = response.get("MerchantRequestID", "")
        checkout_request_id = response.get("CheckoutRequestID", "")
        receipt = (response.get("MpesaReceiptNumber", "") or response.get("MPESA_Reference", "")
                   or response.get("Transaction_Reference", ""))
        claims_success = (
            str(response.get("Status", "")).lower() == "success"
            or response.get("ResultCode") == 0
            or response.get("woocommerce_payment_status") == "complete"
        )
        print("PAYHERO CALLBACK:", {"merchant": merchant_request_id, "checkout": checkout_request_id,
                                    "status": response.get("Status"), "result": response.get("ResultCode"),
                                    "has_u": bool(request.args.get("u"))})

        conn = get_db(); cur = conn.cursor()

        # Find the unlock: by the id in our signed callback URL, else by PayHero's reference
        url_uid, url_sig = request.args.get("u", ""), request.args.get("t", "")
        signed_ok = bool(url_uid) and hmac.compare_digest(url_sig, _callback_sig(url_uid))
        unlock = None
        if url_uid:
            try:
                cur.execute("SELECT id, status, mpesa_checkout_request_id FROM unlocks WHERE id=%s", (url_uid,))
                unlock = cur.fetchone()
            except Exception:
                conn.rollback(); unlock = None
        if not unlock:
            refs = [r for r in (merchant_request_id, checkout_request_id) if r]
            if refs:
                cur.execute("SELECT id, status, mpesa_checkout_request_id FROM unlocks WHERE mpesa_checkout_request_id = ANY(%s) LIMIT 1", (refs,))
                unlock = cur.fetchone()
        if not unlock:
            print("CALLBACK: no matching unlock")
            return jsonify({"status": "ok"}), 200
        if unlock["status"] == "completed":
            return jsonify({"status": "ok"}), 200

        # Decide what really happened
        if signed_ok and str(unlock["id"]) == url_uid:
            outcome = "success" if claims_success else "failed"
        elif not PAYHERO_VERIFY:
            outcome = "success" if claims_success else "failed"   # old behaviour, only if explicitly switched off
        else:
            outcome = _payhero_status(unlock["mpesa_checkout_request_id"])
            if outcome is None or outcome == "pending":
                print("CALLBACK: unverified, leaving pending for status polling")
                return jsonify({"status": "ok"}), 200

        if outcome == "success":
            _complete_unlock(cur, unlock["id"], receipt)
        elif outcome == "failed":
            cur.execute("UPDATE unlocks SET status='failed' WHERE id=%s AND status <> 'completed'", (unlock["id"],))
        conn.commit()
        print("CALLBACK PROCESSED:", unlock["id"], outcome)
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        if conn:
            try: conn.rollback()
            except Exception: pass
        print("CALLBACK ERROR:", e)
        return jsonify({"status": "error"}), 500
    finally:
        if conn:
            conn.close()

@app.route("/api/unlock/status/<listing_id>")
@require_auth
def unlock_status(user, listing_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.status, u.mpesa_checkout_request_id,
               p.full_name AS landlord_name, p.phone AS landlord_phone,
               au.email AS landlord_email, l.street_address
        FROM unlocks u
        JOIN listings l ON l.id = u.listing_id
        JOIN profiles p ON p.id = l.landlord_id
        JOIN auth.users au ON au.id = p.id
        WHERE u.tenant_id = %s AND u.listing_id = %s
    """, (str(user.id), listing_id))
    u = cur.fetchone()

    if not u:
        conn.close()
        return jsonify({"status": "not_unlocked"}), 200

    # Still pending? Ask PayHero directly (at most every 6s per unlock) in case the callback was lost
    if u["status"] == "pending" and u["mpesa_checkout_request_id"] and not _rate_limited(f"verify:{u['id']}", 1, 6):
        outcome = _payhero_status(u["mpesa_checkout_request_id"])
        if outcome == "success":
            _complete_unlock(cur, u["id"], None); conn.commit()
            u = dict(u); u["status"] = "completed"
        elif outcome == "failed":
            cur.execute("UPDATE unlocks SET status='failed' WHERE id=%s AND status='pending'", (u["id"],)); conn.commit()
            u = dict(u); u["status"] = "failed"
    conn.close()

    if u["status"] == "completed":
        return jsonify({
            "status": "completed",
            "landlord_name": u["landlord_name"],
            "landlord_phone": u["landlord_phone"],
            "landlord_email": u["landlord_email"],
            "street_address": u["street_address"],
        }), 200

    return jsonify({"status": u["status"]}), 200

@app.route("/api/unlock/my")
@require_auth
def my_unlocks(user):
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        SELECT u.*,l.id AS listing_id,l.title,c.name AS county_name,a.name AS area_name,l.monthly_rent,l.property_type,
               (SELECT url FROM listing_media WHERE listing_id=l.id AND media_type='photo' ORDER BY sort_order LIMIT 1) AS cover_photo
        FROM unlocks u JOIN listings l ON l.id=u.listing_id
        JOIN counties c ON c.id=l.county_id
        LEFT JOIN areas a ON a.id=l.area_id
        WHERE u.tenant_id=%s AND u.status='completed' ORDER BY u.completed_at DESC
    """, (str(user.id),))
    rows = cur.fetchall(); conn.close()
    return jsonify([dict(r) for r in rows]), 200

# ── REVIEWS ───────────────────────────────────────────────────────────────────
@app.route("/api/listings/<listing_id>/reviews", methods=["POST"])
@require_auth
def add_review(user, listing_id):
    data   = request.json
    rating = int(data.get("rating",0))
    comment= data.get("comment","").strip()
    if not (1 <= rating <= 5): return jsonify({"error":"Rating must be 1–5"}), 400
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT id FROM unlocks WHERE tenant_id=%s AND listing_id=%s AND status='completed'", (str(user.id), listing_id))
    if not cur.fetchone(): conn.close(); return jsonify({"error":"Unlock this listing first before reviewing"}), 403
    cur.execute("""
        INSERT INTO reviews (listing_id,tenant_id,rating,comment)
        VALUES (%s,%s,%s,%s) ON CONFLICT (tenant_id,listing_id) DO UPDATE SET rating=%s,comment=%s
    """, (listing_id, str(user.id), rating, comment, rating, comment))
    conn.commit(); conn.close()
    return jsonify({"message":"Review submitted"}), 201

# ── SEARCH SUGGEST ────────────────────────────────────────────────────────────
@app.route("/api/search/suggest")
def search_suggest():
    q = request.args.get("q","").strip()
    if len(q) < 2: return jsonify([]), 200
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        (SELECT 'county' as type,name,slug as value FROM counties WHERE name ILIKE %s LIMIT 4)
        UNION ALL
        (SELECT 'area' as type,name,slug as value FROM areas WHERE name ILIKE %s LIMIT 4)
        UNION ALL
        (SELECT 'listing' as type,title as name,id::text as value FROM listings WHERE title ILIKE %s AND status='active' LIMIT 4)
        LIMIT 10
    """, (f"%{q}%",f"%{q}%",f"%{q}%"))
    rows = cur.fetchall(); conn.close()
    return jsonify([dict(r) for r in rows]), 200

@app.errorhandler(404)
def not_found(e): return render_template("index.html"), 200

@app.errorhandler(500)
def server_error(e): return jsonify({"error":"Internal server error"}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)