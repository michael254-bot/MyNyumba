import os
import json
import uuid
import base64
import requests
from datetime import datetime, timezone
from functools import wraps

from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras
from supabase import create_client, Client

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-key")
CORS(app, supports_credentials=True)

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
PAYHERO_CALLBACK   = os.getenv("PAYHERO_CALLBACK_URL", "https://placeholder.url/api/mpesa/callback")
PAYHERO_STK_URL    = "https://backend.payhero.co.ke/api/v2/payments"

def payhero_auth():
    """Basic auth header for PayHero."""
    creds = base64.b64encode(
        f"{PAYHERO_USERNAME}:{PAYHERO_PASSWORD}".encode()
    ).decode()
    return {"Authorization": f"Basic {creds}", "Content-Type": "application/json"}

def get_db():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)

def get_current_user():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        token = session.get("access_token", "")
    if not token:
        return None
    try:
        user = supabase.auth.get_user(token)
        return user.user if user else None
    except Exception:
        return None

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

# ── Page routes ──────────────────────────────────────────────────────────────
@app.route("/")
@app.route("/<path:path>")
def index(path=""):
    return render_template("index.html")

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
    return jsonify([dict(r) for r in rows]), 200

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
    return jsonify([dict(r) for r in rows]), 200

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
    page        = max(1, int(request.args.get("page",1)))
    per_page    = min(20, int(request.args.get("per_page",12)))
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
    if min_price:
        conds.append("l.monthly_rent>=%s"); params.append(int(min_price))
    if max_price:
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
    cur.execute(f"""
        SELECT l.*, c.name AS county_name, c.slug AS county_slug,
               a.name AS area_name,
               p.full_name AS landlord_name, p.phone AS landlord_phone,
               (SELECT url FROM listing_media WHERE listing_id=l.id AND media_type='photo' ORDER BY sort_order LIMIT 1) AS cover_photo
        FROM listings l
        JOIN counties c ON c.id=l.county_id
        LEFT JOIN areas a ON a.id=l.area_id
        LEFT JOIN profiles p ON p.id=l.landlord_id
        WHERE {where}
        ORDER BY l.is_featured DESC, {order_by}
        LIMIT %s OFFSET %s
    """, params+[per_page, offset])
    listings = cur.fetchall()
    cur.execute(f"""
        SELECT COUNT(*) FROM listings l
        JOIN counties c ON c.id=l.county_id
        LEFT JOIN areas a ON a.id=l.area_id
        WHERE {where}
    """, params)
    total = cur.fetchone()["count"]
    conn.close()
    return jsonify({"listings":[dict(l) for l in listings],"total":total,"page":page,"per_page":per_page,"pages":-(-total//per_page)}), 200

@app.route("/api/listings/<listing_id>")
def get_listing(listing_id):
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        SELECT l.*, c.name AS county_name, c.slug AS county_slug,
               a.name AS area_name, a.slug AS area_slug,
               p.full_name AS landlord_name, p.phone AS landlord_phone,
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
        SELECT r.*, p.full_name AS reviewer_name
        FROM reviews r JOIN profiles p ON p.id=r.tenant_id
        WHERE r.listing_id=%s ORDER BY r.created_at DESC LIMIT 10
    """, (listing_id,))
    reviews = cur.fetchall()
    cur.execute("UPDATE listings SET views=views+1 WHERE id=%s", (listing_id,))
    conn.commit(); conn.close()
    return jsonify({"listing":dict(listing),"media":[dict(m) for m in media],"reviews":[dict(r) for r in reviews]}), 200

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
    is_admin = (user.email == ADMIN_EMAIL or p["role"] == "admin")

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
    if not updates: conn.close(); return jsonify({"error":"Nothing to update"}), 400
    set_clause = ", ".join(f"{k}=%s" for k in updates)
    cur.execute(f"UPDATE listings SET {set_clause} WHERE id=%s", list(updates.values())+[listing_id])
    conn.commit(); conn.close()
    return jsonify({"message":"Updated"}), 200

@app.route("/api/listings/<listing_id>", methods=["DELETE"])
@require_auth
def delete_listing(user, listing_id):
    p        = get_profile(user.id)
    is_admin = (user.email == ADMIN_EMAIL or (p and p["role"] == "admin"))
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
               (SELECT COUNT(*) FROM listing_media WHERE listing_id=l.id AND media_type='video') AS video_count
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
@app.route("/api/listings/<listing_id>/media", methods=["POST"])
@require_landlord
def upload_media(user, listing_id):
    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT id FROM listings WHERE id=%s AND landlord_id=%s", (listing_id, str(user.id)))
    if not cur.fetchone(): conn.close(); return jsonify({"error":"Not found"}), 404
    if "file" not in request.files: conn.close(); return jsonify({"error":"No file"}), 400

    file       = request.files["file"]
    media_type = request.form.get("media_type","photo")
    ext        = file.filename.rsplit(".",1)[-1].lower()
    filename   = f"{listing_id}/{uuid.uuid4()}.{ext}"
    file_bytes = file.read()
    mime       = f"image/{ext}" if media_type=="photo" else f"video/{ext}"

    try:
        supabase_admin.storage.from_("listing-media").upload(filename, file_bytes, {"content-type": mime})
        public_url = supabase_admin.storage.from_("listing-media").get_public_url(filename)
    except Exception as e:
        conn.close(); return jsonify({"error":str(e)}), 500

    cur.execute("""
        INSERT INTO listing_media (listing_id,media_type,url,storage_path,sort_order)
        VALUES (%s,%s,%s,%s,(SELECT COALESCE(MAX(sort_order)+1,0) FROM listing_media WHERE listing_id=%s))
        RETURNING id,url
    """, (listing_id, media_type, public_url, filename, listing_id))
    media = cur.fetchone(); conn.commit(); conn.close()
    return jsonify({"id":str(media["id"]),"url":media["url"]}), 201

@app.route("/api/listings/<listing_id>/media/<media_id>", methods=["DELETE"])
@require_landlord
def delete_media(user, listing_id, media_id):
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        DELETE FROM listing_media WHERE id=%s
        AND listing_id IN (SELECT id FROM listings WHERE id=%s AND landlord_id=%s)
        RETURNING storage_path
    """, (media_id, listing_id, str(user.id)))
    deleted = cur.fetchone(); conn.commit(); conn.close()
    if deleted and deleted["storage_path"]:
        try: supabase_admin.storage.from_("listing-media").remove([deleted["storage_path"]])
        except: pass
    return jsonify({"message":"Deleted"}), 200

# ── UNLOCKS ───────────────────────────────────────────────────────────────────

@app.route("/api/unlock/initiate", methods=["POST"])
@require_auth
def initiate_unlock(user):
    data       = request.json
    listing_id = data.get("listing_id")
    phone      = data.get("phone","").replace(" ","").replace("+","")
    if not listing_id or not phone:
        return jsonify({"error":"listing_id and phone required"}), 400
    if phone.startswith("0"): phone = "254"+phone[1:]
    if not phone.startswith("254"): phone = "254"+phone

    conn = get_db(); cur = conn.cursor()
    cur.execute("SELECT id,status FROM unlocks WHERE tenant_id=%s AND listing_id=%s", (str(user.id), listing_id))
    existing = cur.fetchone()
    if existing and existing["status"]=="completed":
        conn.close(); return jsonify({"error":"Already unlocked","already_unlocked":True}), 409
    cur.execute("SELECT id FROM listings WHERE id=%s AND status='active'", (listing_id,))
    if not cur.fetchone(): conn.close(); return jsonify({"error":"Listing not found"}), 404

    uid = str(uuid.uuid4())
    cur.execute("""
        INSERT INTO unlocks (id,tenant_id,listing_id,phone,status)
        VALUES (%s,%s,%s,%s,'pending')
        ON CONFLICT (tenant_id,listing_id) DO UPDATE SET phone=%s,status='pending'
        RETURNING id
    """, (uid, str(user.id), listing_id, phone, phone))
    unlock = cur.fetchone(); conn.commit()

    # ── PayHero STK Push ──────────────────────────────────────────────────────
    try:
        resp = requests.post(
            PAYHERO_STK_URL,
            json={
                "amount":             500,
                "phone_number":       phone,
                "channel_id":         PAYHERO_CHANNEL_ID,
                "provider":           "m-pesa",
                "external_reference": f"MyNyumba-{str(unlock['id'])[:8]}",
                "callback_url":       PAYHERO_CALLBACK,
            },
            headers=payhero_auth(),
            timeout=15
        )
        data        = resp.json()
        checkout_id = data.get("reference") or data.get("CheckoutRequestID", "")
        if checkout_id:
            cur.execute(
                "UPDATE unlocks SET mpesa_checkout_request_id=%s WHERE id=%s",
                (checkout_id, str(unlock["id"]))
            )
            conn.commit()
        conn.close()
        return jsonify({
            "message":             "STK Push sent. Enter your M-Pesa PIN.",
            "checkout_request_id": checkout_id,
            "unlock_id":           str(unlock["id"])
        }), 200
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 500

@app.route("/api/mpesa/callback", methods=["POST"])
def mpesa_callback():
    try:
        data    = request.json
        # PayHero callback fields
        status  = data.get("status", "")             # "Success" or "Failed"
        ref     = data.get("reference", "")           # matches checkout_request_id
        receipt = data.get("provider_reference", "")  # M-Pesa receipt number

        conn = get_db(); cur = conn.cursor()
        if status == "Success":
            cur.execute("""
                UPDATE unlocks
                SET status='completed', mpesa_receipt_number=%s, completed_at=NOW()
                WHERE mpesa_checkout_request_id=%s
            """, (receipt, ref))
            cur.execute("""
                UPDATE listings SET unlock_count=unlock_count+1
                WHERE id=(SELECT listing_id FROM unlocks WHERE mpesa_checkout_request_id=%s)
            """, (ref,))
        else:
            cur.execute(
                "UPDATE unlocks SET status='failed' WHERE mpesa_checkout_request_id=%s",
                (ref,)
            )
        conn.commit(); conn.close()
    except Exception:
        pass
    return jsonify({"status": "ok"}), 200

@app.route("/api/unlock/status/<listing_id>")
@require_auth
def unlock_status(user, listing_id):
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("""
            SELECT u.status,
                   p.full_name  AS landlord_name,
                   p.phone      AS landlord_phone,
                   p.email      AS landlord_email
            FROM unlocks u
            LEFT JOIN listings l ON l.id = u.listing_id
            LEFT JOIN profiles p ON p.id = l.landlord_id
            WHERE u.tenant_id = %s AND u.listing_id = %s
        """, (str(user.id), listing_id))
        u = cur.fetchone(); conn.close()
        if not u:
            return jsonify({"status": "not_unlocked"}), 200
        if u["status"] == "completed":
            return jsonify({
                "status":         "completed",
                "landlord_name":  u["landlord_name"]  or "",
                "landlord_phone": u["landlord_phone"] or "",
                "landlord_email": u["landlord_email"] or ""
            }), 200
        return jsonify({"status": u["status"]}), 200
    except Exception as e:
        return jsonify({"status": "not_unlocked", "error": str(e)}), 200

@app.route("/api/unlock/my")
@require_auth
def my_unlocks(user):
    conn = get_db(); cur = conn.cursor()
    cur.execute("""
        SELECT u.*,l.id AS listing_id,l.title,c.name AS county_name,a.name AS area_name,l.monthly_rent,l.property_type
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