import os
import json
import uuid
import base64
import requests
from datetime import datetime, timezone
from functools import wraps

from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_cors import CORS
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras
from supabase import create_client, Client

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-key")
CORS(app, supports_credentials=True)

# ─── Supabase client ────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ─── PostgreSQL direct connection ────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL")

def get_db():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    return conn

# ─── M-Pesa config ───────────────────────────────────────────────────────────
MPESA_CONSUMER_KEY    = os.getenv("MPESA_CONSUMER_KEY", "placeholder-key")
MPESA_CONSUMER_SECRET = os.getenv("MPESA_CONSUMER_SECRET", "placeholder-secret")
MPESA_SHORTCODE       = os.getenv("MPESA_SHORTCODE", "174379")
MPESA_PASSKEY         = os.getenv("MPESA_PASSKEY", "placeholder-passkey")
MPESA_CALLBACK_URL    = os.getenv("MPESA_CALLBACK_URL", "https://placeholder.callback.url/api/mpesa/callback")
MPESA_STK_URL         = os.getenv("MPESA_STK_URL", "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest")
MPESA_TOKEN_URL       = os.getenv("MPESA_TOKEN_URL", "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials")

# ─── Auth helpers ────────────────────────────────────────────────────────────
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
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT role FROM profiles WHERE id = %s", (str(user.id),))
        profile = cur.fetchone()
        conn.close()
        if not profile or profile["role"] not in ("landlord", "admin"):
            return jsonify({"error": "Landlord account required"}), 403
        return f(*args, user=user, **kwargs)
    return decorated

# ─── PAGE ROUTES ─────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/browse")
def browse():
    return render_template("index.html")

@app.route("/county/<slug>")
def county(slug):
    return render_template("index.html")

@app.route("/listing/<listing_id>")
def listing_detail(listing_id):
    return render_template("index.html")

@app.route("/dashboard")
def dashboard():
    return render_template("index.html")

@app.route("/login")
def login_page():
    return render_template("index.html")

@app.route("/register")
def register_page():
    return render_template("index.html")

# ─── API: AUTH ───────────────────────────────────────────────────────────────
@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.json
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    full_name = data.get("full_name", "").strip()
    role = data.get("role", "tenant")
    phone = data.get("phone", "").strip()

    if not email or not password or not full_name:
        return jsonify({"error": "Email, password and full name are required"}), 400
    if role not in ("tenant", "landlord"):
        return jsonify({"error": "Role must be tenant or landlord"}), 400

    try:
        res = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {"data": {"full_name": full_name, "role": role}}
        })
        if res.user:
            # Update profile with phone
            if phone:
                conn = get_db()
                cur = conn.cursor()
                cur.execute("UPDATE profiles SET phone = %s WHERE id = %s",
                            (phone, str(res.user.id)))
                conn.commit()
                conn.close()
            return jsonify({
                "message": "Registration successful. Check your email to confirm.",
                "user": {"id": str(res.user.id), "email": email, "role": role}
            }), 201
        return jsonify({"error": "Registration failed"}), 400
    except Exception as e:
        msg = str(e)
        if "already registered" in msg.lower():
            return jsonify({"error": "Email already registered"}), 409
        return jsonify({"error": msg}), 400

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
    try:
        res = supabase.auth.sign_in_with_password({"email": email, "password": password})
        if res.user and res.session:
            # Fetch profile
            conn = get_db()
            cur = conn.cursor()
            cur.execute("SELECT * FROM profiles WHERE id = %s", (str(res.user.id),))
            profile = cur.fetchone()
            conn.close()
            return jsonify({
                "access_token": res.session.access_token,
                "refresh_token": res.session.refresh_token,
                "user": {
                    "id": str(res.user.id),
                    "email": res.user.email,
                    "full_name": profile["full_name"] if profile else "",
                    "role": profile["role"] if profile else "tenant",
                    "phone": profile["phone"] if profile else "",
                    "avatar_url": profile["avatar_url"] if profile else ""
                }
            }), 200
        return jsonify({"error": "Invalid credentials"}), 401
    except Exception as e:
        return jsonify({"error": "Invalid email or password"}), 401

@app.route("/api/auth/logout", methods=["POST"])
def logout():
    try:
        supabase.auth.sign_out()
    except Exception:
        pass
    session.clear()
    return jsonify({"message": "Logged out"}), 200

@app.route("/api/auth/me", methods=["GET"])
@require_auth
def me(user):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM profiles WHERE id = %s", (str(user.id),))
    profile = cur.fetchone()
    conn.close()
    return jsonify({
        "id": str(user.id),
        "email": user.email,
        "full_name": profile["full_name"] if profile else "",
        "role": profile["role"] if profile else "tenant",
        "phone": profile["phone"] if profile else "",
        "avatar_url": profile["avatar_url"] if profile else "",
        "is_verified": profile["is_verified"] if profile else False
    }), 200

@app.route("/api/auth/profile", methods=["PUT"])
@require_auth
def update_profile(user):
    data = request.json
    allowed = ["full_name", "phone"]
    updates = {k: data[k] for k in allowed if k in data}
    if not updates:
        return jsonify({"error": "Nothing to update"}), 400
    conn = get_db()
    cur = conn.cursor()
    set_clause = ", ".join(f"{k} = %s" for k in updates)
    values = list(updates.values()) + [str(user.id)]
    cur.execute(f"UPDATE profiles SET {set_clause} WHERE id = %s", values)
    conn.commit()
    conn.close()
    return jsonify({"message": "Profile updated"}), 200

# ─── API: COUNTIES & AREAS ───────────────────────────────────────────────────
@app.route("/api/counties", methods=["GET"])
def get_counties():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT c.*, COUNT(l.id) AS listing_count
        FROM counties c
        LEFT JOIN listings l ON l.county_id = c.id AND l.status = 'active'
        GROUP BY c.id ORDER BY c.region, c.name
    """)
    counties = cur.fetchall()
    conn.close()
    return jsonify([dict(c) for c in counties]), 200

@app.route("/api/counties/<slug>", methods=["GET"])
def get_county(slug):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM counties WHERE slug = %s", (slug,))
    county = cur.fetchone()
    if not county:
        conn.close()
        return jsonify({"error": "County not found"}), 404
    cur.execute("SELECT * FROM areas WHERE county_id = %s ORDER BY name", (county["id"],))
    areas = cur.fetchall()
    conn.close()
    return jsonify({"county": dict(county), "areas": [dict(a) for a in areas]}), 200

@app.route("/api/areas", methods=["GET"])
def get_areas():
    county_id = request.args.get("county_id")
    conn = get_db()
    cur = conn.cursor()
    if county_id:
        cur.execute("SELECT * FROM areas WHERE county_id = %s ORDER BY name", (county_id,))
    else:
        cur.execute("SELECT a.*, c.name as county_name FROM areas a JOIN counties c ON c.id = a.county_id ORDER BY c.name, a.name")
    areas = cur.fetchall()
    conn.close()
    return jsonify([dict(a) for a in areas]), 200

# ─── API: LISTINGS ───────────────────────────────────────────────────────────
@app.route("/api/listings", methods=["GET"])
def get_listings():
    q           = request.args.get("q", "").strip()
    county_slug = request.args.get("county", "")
    area_id     = request.args.get("area_id", "")
    prop_type   = request.args.get("type", "")
    min_price   = request.args.get("min_price", "")
    max_price   = request.args.get("max_price", "")
    sort        = request.args.get("sort", "newest")
    page        = max(1, int(request.args.get("page", 1)))
    per_page    = min(20, int(request.args.get("per_page", 12)))
    # amenity filters
    amenities = {
        "has_water": request.args.get("water"),
        "has_parking": request.args.get("parking"),
        "has_wifi": request.args.get("wifi"),
        "has_security": request.args.get("security"),
        "is_furnished": request.args.get("furnished"),
        "has_dsq": request.args.get("dsq"),
        "has_gym": request.args.get("gym"),
        "has_cctv": request.args.get("cctv"),
        "has_borehole": request.args.get("borehole"),
        "has_generator": request.args.get("generator"),
        "is_pet_friendly": request.args.get("pet_friendly"),
    }

    conditions = ["l.status = 'active'"]
    params = []

    if q:
        conditions.append("""(
            l.title ILIKE %s OR l.description ILIKE %s OR
            l.street_address ILIKE %s OR a.name ILIKE %s OR c.name ILIKE %s
        )""")
        like = f"%{q}%"
        params += [like, like, like, like, like]

    if county_slug:
        conditions.append("c.slug = %s")
        params.append(county_slug)

    if area_id:
        conditions.append("l.area_id = %s")
        params.append(area_id)

    if prop_type:
        conditions.append("l.property_type = %s")
        params.append(prop_type)

    if min_price:
        conditions.append("l.monthly_rent >= %s")
        params.append(int(min_price))

    if max_price:
        conditions.append("l.monthly_rent <= %s")
        params.append(int(max_price))

    for col, val in amenities.items():
        if val == "true":
            conditions.append(f"l.{col} = TRUE")

    order_map = {
        "newest": "l.created_at DESC",
        "oldest": "l.created_at ASC",
        "price_asc": "l.monthly_rent ASC",
        "price_desc": "l.monthly_rent DESC",
        "rating": "l.average_rating DESC",
        "popular": "l.unlock_count DESC"
    }
    order_by = order_map.get(sort, "l.created_at DESC")
    where = " AND ".join(conditions)
    offset = (page - 1) * per_page

    conn = get_db()
    cur = conn.cursor()

    cur.execute(f"""
        SELECT l.*, c.name AS county_name, c.slug AS county_slug,
               a.name AS area_name,
               p.full_name AS landlord_name,
               (SELECT url FROM listing_media WHERE listing_id = l.id AND media_type = 'photo' ORDER BY sort_order LIMIT 1) AS cover_photo
        FROM listings l
        JOIN counties c ON c.id = l.county_id
        LEFT JOIN areas a ON a.id = l.area_id
        LEFT JOIN profiles p ON p.id = l.landlord_id
        WHERE {where}
        ORDER BY l.is_featured DESC, {order_by}
        LIMIT %s OFFSET %s
    """, params + [per_page, offset])
    listings = cur.fetchall()

    cur.execute(f"""
        SELECT COUNT(*) FROM listings l
        JOIN counties c ON c.id = l.county_id
        LEFT JOIN areas a ON a.id = l.area_id
        WHERE {where}
    """, params)
    total = cur.fetchone()["count"]
    conn.close()

    return jsonify({
        "listings": [dict(l) for l in listings],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": -(-total // per_page)
    }), 200

@app.route("/api/listings/<listing_id>", methods=["GET"])
def get_listing(listing_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT l.*, c.name AS county_name, c.slug AS county_slug,
               a.name AS area_name, a.slug AS area_slug,
               p.full_name AS landlord_name, p.avatar_url AS landlord_avatar,
               p.is_verified AS landlord_verified
        FROM listings l
        JOIN counties c ON c.id = l.county_id
        LEFT JOIN areas a ON a.id = l.area_id
        LEFT JOIN profiles p ON p.id = l.landlord_id
        WHERE l.id = %s AND l.status = 'active'
    """, (listing_id,))
    listing = cur.fetchone()
    if not listing:
        conn.close()
        return jsonify({"error": "Listing not found"}), 404

    cur.execute("SELECT * FROM listing_media WHERE listing_id = %s ORDER BY sort_order", (listing_id,))
    media = cur.fetchall()

    cur.execute("""
        SELECT r.*, p.full_name AS reviewer_name
        FROM reviews r JOIN profiles p ON p.id = r.tenant_id
        WHERE r.listing_id = %s ORDER BY r.created_at DESC LIMIT 10
    """, (listing_id,))
    reviews = cur.fetchall()

    # Increment view count
    cur.execute("UPDATE listings SET views = views + 1 WHERE id = %s", (listing_id,))
    conn.commit()
    conn.close()

    return jsonify({
        "listing": dict(listing),
        "media": [dict(m) for m in media],
        "reviews": [dict(r) for r in reviews]
    }), 200

@app.route("/api/listings", methods=["POST"])
@require_landlord
def create_listing(user):
    data = request.json

    required = ["title", "county_id", "property_type", "monthly_rent"]
    for f in required:
        if not data.get(f):
            return jsonify({"error": f"{f} is required"}), 400

    listing_id = str(uuid.uuid4())
    conn = get_db()
    cur = conn.cursor()

    amenity_fields = [
        "has_water","has_borehole","has_security","has_cctv","has_parking",
        "has_wifi","has_electricity_token","has_generator","is_furnished",
        "has_dsq","has_garbage","has_caretaker","has_gym","has_pool",
        "has_playground","is_pet_friendly","has_balcony","has_lift",
        "near_school","near_hospital","near_market","near_matatu",
        "near_church","near_water_kiosk"
    ]

    cur.execute("""
        INSERT INTO listings (
            id, landlord_id, county_id, area_id, title, description,
            property_type, floor, monthly_rent, deposit_months, street_address,
            has_water, has_borehole, has_security, has_cctv, has_parking,
            has_wifi, has_electricity_token, has_generator, is_furnished,
            has_dsq, has_garbage, has_caretaker, has_gym, has_pool,
            has_playground, is_pet_friendly, has_balcony, has_lift,
            near_school, near_hospital, near_market, near_matatu,
            near_church, near_water_kiosk, status
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'active'
        ) RETURNING id
    """, (
        listing_id, str(user.id), data.get("county_id"), data.get("area_id"),
        data["title"], data.get("description"), data["property_type"],
        data.get("floor"), int(data["monthly_rent"]),
        int(data.get("deposit_months", 2)), data.get("street_address"),
        *[bool(data.get(f, False)) for f in amenity_fields]
    ))
    result = cur.fetchone()
    conn.commit()
    conn.close()
    return jsonify({"listing_id": str(result["id"]), "message": "Listing created"}), 201

@app.route("/api/listings/<listing_id>", methods=["PUT"])
@require_landlord
def update_listing(user, listing_id):
    data = request.json
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM listings WHERE id = %s AND landlord_id = %s", (listing_id, str(user.id)))
    if not cur.fetchone():
        conn.close()
        return jsonify({"error": "Listing not found or not yours"}), 404

    updatable = [
        "title","description","property_type","floor","monthly_rent",
        "deposit_months","street_address","county_id","area_id",
        "has_water","has_borehole","has_security","has_cctv","has_parking",
        "has_wifi","has_electricity_token","has_generator","is_furnished",
        "has_dsq","has_garbage","has_caretaker","has_gym","has_pool",
        "has_playground","is_pet_friendly","has_balcony","has_lift",
        "near_school","near_hospital","near_market","near_matatu",
        "near_church","near_water_kiosk","status"
    ]
    updates = {k: data[k] for k in updatable if k in data}
    if not updates:
        conn.close()
        return jsonify({"error": "Nothing to update"}), 400

    set_clause = ", ".join(f"{k} = %s" for k in updates)
    values = list(updates.values()) + [listing_id, str(user.id)]
    cur.execute(f"UPDATE listings SET {set_clause} WHERE id = %s AND landlord_id = %s", values)
    conn.commit()
    conn.close()
    return jsonify({"message": "Listing updated"}), 200

@app.route("/api/listings/<listing_id>", methods=["DELETE"])
@require_landlord
def delete_listing(user, listing_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM listings WHERE id = %s AND landlord_id = %s RETURNING id",
                (listing_id, str(user.id)))
    deleted = cur.fetchone()
    conn.commit()
    conn.close()
    if not deleted:
        return jsonify({"error": "Listing not found"}), 404
    return jsonify({"message": "Listing deleted"}), 200

# ─── API: LANDLORD DASHBOARD ─────────────────────────────────────────────────
@app.route("/api/landlord/listings", methods=["GET"])
@require_landlord
def landlord_listings(user):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT l.*, c.name AS county_name, a.name AS area_name,
               (SELECT COUNT(*) FROM listing_media WHERE listing_id = l.id AND media_type = 'photo') AS photo_count,
               (SELECT COUNT(*) FROM listing_media WHERE listing_id = l.id AND media_type = 'video') AS video_count
        FROM listings l
        JOIN counties c ON c.id = l.county_id
        LEFT JOIN areas a ON a.id = l.area_id
        WHERE l.landlord_id = %s
        ORDER BY l.created_at DESC
    """, (str(user.id),))
    listings = cur.fetchall()

    cur.execute("""
        SELECT
            COUNT(*) FILTER (WHERE status = 'active') AS active,
            COUNT(*) FILTER (WHERE status = 'pending') AS pending,
            SUM(views) AS total_views,
            SUM(unlock_count) AS total_unlocks
        FROM listings WHERE landlord_id = %s
    """, (str(user.id),))
    stats = cur.fetchone()
    conn.close()
    return jsonify({
        "listings": [dict(l) for l in listings],
        "stats": dict(stats) if stats else {}
    }), 200

# ─── API: MEDIA UPLOAD ───────────────────────────────────────────────────────
@app.route("/api/listings/<listing_id>/media", methods=["POST"])
@require_landlord
def upload_media(user, listing_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM listings WHERE id = %s AND landlord_id = %s", (listing_id, str(user.id)))
    if not cur.fetchone():
        conn.close()
        return jsonify({"error": "Listing not found"}), 404

    if "file" not in request.files:
        conn.close()
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    media_type = request.form.get("media_type", "photo")
    ext = file.filename.rsplit(".", 1)[-1].lower()
    filename = f"{listing_id}/{uuid.uuid4()}.{ext}"

    file_bytes = file.read()
    mime = "image/jpeg" if ext in ("jpg","jpeg") else f"{'image' if media_type=='photo' else 'video'}/{ext}"

    try:
        supabase_admin.storage.from_("listing-media").upload(filename, file_bytes, {"content-type": mime})
        public_url = supabase_admin.storage.from_("listing-media").get_public_url(filename)
    except Exception as e:
        conn.close()
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500

    cur.execute("""
        INSERT INTO listing_media (listing_id, media_type, url, storage_path, sort_order)
        VALUES (%s, %s, %s, %s, (SELECT COALESCE(MAX(sort_order)+1,0) FROM listing_media WHERE listing_id = %s))
        RETURNING id, url
    """, (listing_id, media_type, public_url, filename, listing_id))
    media = cur.fetchone()
    conn.commit()
    conn.close()
    return jsonify({"id": str(media["id"]), "url": media["url"]}), 201

@app.route("/api/listings/<listing_id>/media/<media_id>", methods=["DELETE"])
@require_landlord
def delete_media(user, listing_id, media_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        DELETE FROM listing_media WHERE id = %s
        AND listing_id IN (SELECT id FROM listings WHERE id = %s AND landlord_id = %s)
        RETURNING storage_path
    """, (media_id, listing_id, str(user.id)))
    deleted = cur.fetchone()
    conn.commit()
    conn.close()
    if deleted and deleted["storage_path"]:
        try:
            supabase_admin.storage.from_("listing-media").remove([deleted["storage_path"]])
        except Exception:
            pass
    return jsonify({"message": "Deleted"}), 200

# ─── API: UNLOCKS ────────────────────────────────────────────────────────────
def get_mpesa_token():
    credentials = base64.b64encode(f"{MPESA_CONSUMER_KEY}:{MPESA_CONSUMER_SECRET}".encode()).decode()
    try:
        resp = requests.get(MPESA_TOKEN_URL, headers={"Authorization": f"Basic {credentials}"}, timeout=10)
        return resp.json().get("access_token")
    except Exception:
        return None

@app.route("/api/unlock/initiate", methods=["POST"])
@require_auth
def initiate_unlock(user):
    data = request.json
    listing_id = data.get("listing_id")
    phone = data.get("phone", "").replace(" ", "").replace("+", "")

    if not listing_id or not phone:
        return jsonify({"error": "listing_id and phone required"}), 400

    # Normalize phone
    if phone.startswith("0"):
        phone = "254" + phone[1:]
    if not phone.startswith("254"):
        phone = "254" + phone

    conn = get_db()
    cur = conn.cursor()

    # Check already unlocked
    cur.execute("SELECT id, status FROM unlocks WHERE tenant_id = %s AND listing_id = %s",
                (str(user.id), listing_id))
    existing = cur.fetchone()
    if existing and existing["status"] == "completed":
        conn.close()
        return jsonify({"error": "Already unlocked", "already_unlocked": True}), 409

    # Check listing exists
    cur.execute("SELECT id FROM listings WHERE id = %s AND status = 'active'", (listing_id,))
    if not cur.fetchone():
        conn.close()
        return jsonify({"error": "Listing not found"}), 404

    # Create pending unlock record
    unlock_id = str(uuid.uuid4())
    cur.execute("""
        INSERT INTO unlocks (id, tenant_id, listing_id, phone, status)
        VALUES (%s, %s, %s, %s, 'pending')
        ON CONFLICT (tenant_id, listing_id) DO UPDATE SET phone = %s, status = 'pending'
        RETURNING id
    """, (unlock_id, str(user.id), listing_id, phone, phone))
    unlock = cur.fetchone()
    conn.commit()

    # M-Pesa STK Push
    token = get_mpesa_token()
    if not token:
        conn.close()
        return jsonify({"error": "M-Pesa service unavailable. Try again later."}), 503

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    password = base64.b64encode(f"{MPESA_SHORTCODE}{MPESA_PASSKEY}{timestamp}".encode()).decode()

    stk_payload = {
        "BusinessShortCode": MPESA_SHORTCODE,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": 500,
        "PartyA": phone,
        "PartyB": MPESA_SHORTCODE,
        "PhoneNumber": phone,
        "CallBackURL": MPESA_CALLBACK_URL,
        "AccountReference": f"MyNyumba-{unlock_id[:8]}",
        "TransactionDesc": "House listing unlock"
    }

    try:
        stk_resp = requests.post(
            MPESA_STK_URL,
            json=stk_payload,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            timeout=15
        )
        stk_data = stk_resp.json()
        checkout_id = stk_data.get("CheckoutRequestID")
        if checkout_id:
            cur.execute("UPDATE unlocks SET mpesa_checkout_request_id = %s WHERE id = %s",
                        (checkout_id, str(unlock["id"])))
            conn.commit()
        conn.close()
        return jsonify({
            "message": "STK Push sent. Enter M-Pesa PIN on your phone.",
            "checkout_request_id": checkout_id,
            "unlock_id": str(unlock["id"])
        }), 200
    except Exception as e:
        conn.close()
        return jsonify({"error": f"M-Pesa request failed: {str(e)}"}), 500

@app.route("/api/mpesa/callback", methods=["POST"])
def mpesa_callback():
    data = request.json
    try:
        result = data["Body"]["stkCallback"]
        checkout_id = result["CheckoutRequestID"]
        result_code = result["ResultCode"]

        conn = get_db()
        cur = conn.cursor()

        if result_code == 0:
            meta = {item["Name"]: item["Value"] for item in result["CallbackMetadata"]["Item"]}
            receipt = meta.get("MpesaReceiptNumber", "")
            cur.execute("""
                UPDATE unlocks SET status = 'completed', mpesa_receipt_number = %s, completed_at = NOW()
                WHERE mpesa_checkout_request_id = %s
            """, (receipt, checkout_id))
            # Increment listing unlock count
            cur.execute("""
                UPDATE listings SET unlock_count = unlock_count + 1
                WHERE id = (SELECT listing_id FROM unlocks WHERE mpesa_checkout_request_id = %s)
            """, (checkout_id,))
        else:
            cur.execute("""
                UPDATE unlocks SET status = 'failed'
                WHERE mpesa_checkout_request_id = %s
            """, (checkout_id,))
        conn.commit()
        conn.close()
    except Exception:
        pass
    return jsonify({"ResultCode": 0, "ResultDesc": "Accepted"}), 200

@app.route("/api/unlock/status/<listing_id>", methods=["GET"])
@require_auth
def unlock_status(user, listing_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.status, u.id, l.title,
               p.full_name AS landlord_name, p.phone AS landlord_phone,
               p.id AS landlord_id
        FROM unlocks u
        JOIN listings l ON l.id = u.listing_id
        JOIN profiles p ON p.id = l.landlord_id
        WHERE u.tenant_id = %s AND u.listing_id = %s
    """, (str(user.id), listing_id))
    unlock = cur.fetchone()
    conn.close()
    if not unlock:
        return jsonify({"status": "not_unlocked"}), 200
    if unlock["status"] == "completed":
        return jsonify({
            "status": "completed",
            "landlord_name": unlock["landlord_name"],
            "landlord_phone": unlock["landlord_phone"]
        }), 200
    return jsonify({"status": unlock["status"]}), 200

@app.route("/api/unlock/my", methods=["GET"])
@require_auth
def my_unlocks(user):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.*, l.title, c.name AS county_name, a.name AS area_name,
               l.monthly_rent, l.property_type
        FROM unlocks u
        JOIN listings l ON l.id = u.listing_id
        JOIN counties c ON c.id = l.county_id
        LEFT JOIN areas a ON a.id = l.area_id
        WHERE u.tenant_id = %s AND u.status = 'completed'
        ORDER BY u.completed_at DESC
    """, (str(user.id),))
    unlocks = cur.fetchall()
    conn.close()
    return jsonify([dict(u) for u in unlocks]), 200

# ─── API: REVIEWS ────────────────────────────────────────────────────────────
@app.route("/api/listings/<listing_id>/reviews", methods=["POST"])
@require_auth
def add_review(user, listing_id):
    data = request.json
    rating = int(data.get("rating", 0))
    comment = data.get("comment", "").strip()
    if not (1 <= rating <= 5):
        return jsonify({"error": "Rating must be 1–5"}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM unlocks WHERE tenant_id = %s AND listing_id = %s AND status = 'completed'",
                (str(user.id), listing_id))
    if not cur.fetchone():
        conn.close()
        return jsonify({"error": "You must unlock this listing before reviewing"}), 403
    try:
        cur.execute("""
            INSERT INTO reviews (listing_id, tenant_id, rating, comment)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (tenant_id, listing_id) DO UPDATE SET rating = %s, comment = %s
        """, (listing_id, str(user.id), rating, comment, rating, comment))
        conn.commit()
        conn.close()
        return jsonify({"message": "Review submitted"}), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 500

# ─── API: SEARCH AUTOCOMPLETE ────────────────────────────────────────────────
@app.route("/api/search/suggest", methods=["GET"])
def search_suggest():
    q = request.args.get("q", "").strip()
    if len(q) < 2:
        return jsonify([]), 200
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        (SELECT 'county' as type, name, slug as value FROM counties WHERE name ILIKE %s LIMIT 5)
        UNION ALL
        (SELECT 'area' as type, name, slug as value FROM areas WHERE name ILIKE %s LIMIT 5)
        UNION ALL
        (SELECT 'listing' as type, title as name, id::text as value FROM listings WHERE title ILIKE %s AND status='active' LIMIT 5)
        LIMIT 12
    """, (f"%{q}%", f"%{q}%", f"%{q}%"))
    results = cur.fetchall()
    conn.close()
    return jsonify([dict(r) for r in results]), 200

# ─── ERROR HANDLERS ───────────────────────────────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    return render_template("index.html"), 200

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)