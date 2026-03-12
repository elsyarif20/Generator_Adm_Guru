import streamlit as st
import firebase_admin
from firebase_admin import credentials, firestore
import json

# --- Konfigurasi Halaman Streamlit ---
st.set_page_config(
    page_title="Generator Administrasi Guru",
    page_icon="📚",
    layout="wide"
)

# --- Inisialisasi Firebase ---
# Pastikan Anda mengunduh file serviceAccountKey.json dari Firebase Console
# (Project Settings > Service Accounts > Generate new private key)
# dan letakkan di direktori yang sama, atau gunakan Streamlit Secrets.

@st.cache_resource
def init_firebase():
    if not firebase_admin._apps:
        try:
            # Cara 1: Menggunakan file JSON lokal (untuk development)
            # cred = credentials.Certificate("serviceAccountKey.json")
            
            # Cara 2: Menggunakan Streamlit Secrets (untuk deployment)
            # Anda perlu mengatur secrets di Streamlit Cloud:
            # [firebase]
            # type = "service_account"
            # project_id = "..."
            # ...
            
            if "firebase" in st.secrets:
                cred_dict = dict(st.secrets["firebase"])
                cred = credentials.Certificate(cred_dict)
                firebase_admin.initialize_app(cred)
                return firestore.client()
            else:
                st.warning("Firebase credentials tidak ditemukan di st.secrets. Menggunakan mode lokal tanpa database.")
                return None
        except Exception as e:
            st.error(f"Gagal menginisialisasi Firebase: {e}")
            return None
    else:
        return firestore.client()

db = init_firebase()

# --- Fungsi Database ---
def save_feedback(name, feedback_text):
    if db:
        try:
            doc_ref = db.collection("feedback").document()
            doc_ref.set({
                "name": name,
                "feedback": feedback_text,
                "timestamp": firestore.SERVER_TIMESTAMP
            })
            return True
        except Exception as e:
            st.error(f"Gagal menyimpan ke Firebase: {e}")
            return False
    return False

def get_recent_feedback():
    if db:
        try:
            docs = db.collection("feedback").order_by("timestamp", direction=firestore.Query.DESCENDING).limit(5).stream()
            return [{"name": doc.to_dict().get("name"), "feedback": doc.to_dict().get("feedback")} for doc in docs]
        except Exception as e:
            st.error(f"Gagal mengambil data dari Firebase: {e}")
            return []
    return []

# --- Antarmuka Streamlit ---
st.title("📚 Generator Administrasi Guru & Bank Soal")
st.markdown("Aplikasi ini adalah contoh integrasi **Streamlit** dengan **Firebase Firestore**.")

# Tab Navigasi
tab1, tab2 = st.tabs(["Beranda", "Feedback"])

with tab1:
    st.header("Selamat Datang")
    st.write("""
    Ini adalah versi Streamlit dari aplikasi Generator Administrasi Guru.
    
    Untuk menggunakan aplikasi ini secara penuh, Anda perlu:
    1. Mengatur kunci API Gemini di Streamlit Secrets.
    2. Mengatur kredensial Firebase di Streamlit Secrets.
    3. Menambahkan logika generasi konten menggunakan SDK Python Gemini.
    """)
    
    st.info("Catatan: Aplikasi utama saat ini dibangun menggunakan React (Node.js). File `app.py` ini disediakan sebagai titik awal jika Anda ingin memigrasikannya ke Streamlit.")

with tab2:
    st.header("Kirim Feedback (Tersimpan di Firebase)")
    
    with st.form("feedback_form"):
        name = st.text_input("Nama Anda")
        feedback_text = st.text_area("Feedback atau Saran")
        submit_button = st.form_submit_button("Kirim Feedback")
        
        if submit_button:
            if name and feedback_text:
                if save_feedback(name, feedback_text):
                    st.success("Terima kasih! Feedback Anda telah disimpan di Firebase Firestore.")
                else:
                    st.error("Gagal menyimpan feedback. Pastikan Firebase sudah dikonfigurasi.")
            else:
                st.warning("Mohon lengkapi nama dan feedback.")
                
    st.subheader("Feedback Terbaru")
    recent_feedback = get_recent_feedback()
    
    if recent_feedback:
        for item in recent_feedback:
            with st.chat_message("user"):
                st.write(f"**{item['name']}**")
                st.write(item['feedback'])
    else:
        st.write("Belum ada feedback atau database tidak terhubung.")
