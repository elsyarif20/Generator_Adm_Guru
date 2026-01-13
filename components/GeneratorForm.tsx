
import React, { useState, useEffect, useRef } from 'react';
import { Module, FormData } from '../types';
import { KELAS_OPTIONS, MATA_PELAJARAN_OPTIONS, ALOKASI_WAKTU_OPTIONS, TEACHER_DATA } from '../constants';
import Spinner from './Spinner';

interface GeneratorFormProps {
  module: Module;
  onSubmit: (formData: FormData) => void;
  onBack: () => void;
  onShowAIAssistant: (data: Partial<FormData>, type: 'cp' | 'topic') => void;
  isLoading: boolean;
  generationProgress: number;
}

const LOG_STEPS: Record<string, { progress: number; message: string }[]> = {
    admin: [
        { progress: 5, message: "Menginisialisasi Model AI..." },
        { progress: 15, message: "Menganalisis Capaian Pembelajaran (CP) & Fase..." },
        { progress: 30, message: "Menyusun Alur Tujuan Pembelajaran (ATP)..." },
        { progress: 45, message: "Meng-generate Prota & Promes..." },
        { progress: 60, message: "Merancang Modul Ajar..." },
        { progress: 75, message: "Menyusun KKTP..." },
        { progress: 90, message: "Finalisasi format dokumen..." },
        { progress: 100, message: "Selesai!" }
    ],
    soal: [
        { progress: 5, message: "Menginisialisasi Model AI..." },
        { progress: 15, message: "Menganalisis Topik..." },
        { progress: 30, message: "Menyusun Kisi-kisi Soal & TKA..." },
        { progress: 50, message: "Meng-generate Naskah Soal (PG, Essay, TKA)..." },
        { progress: 70, message: "Membuat Kunci Jawaban..." },
        { progress: 85, message: "Melakukan Analisis Kualitatif..." },
        { progress: 95, message: "Finalisasi format dokumen..." },
        { progress: 100, message: "Selesai!" }
    ],
    tryout: [
        { progress: 5, message: "Menginisialisasi Model AI..." },
        { progress: 15, message: "Menganalisis Kurikulum Terpadu (Kelas 10-12)..." },
        { progress: 30, message: "Merumuskan Kisi-kisi Try Out/UAS..." },
        { progress: 50, message: "Meng-generate Soal Standar (PG & Essay)..." },
        { progress: 70, message: "Meng-generate Soal TKA (Akademik)..." },
        { progress: 85, message: "Finalisasi Kunci Jawaban & Rubrik..." },
        { progress: 100, message: "Selesai!" }
    ]
};

const GeneratorForm: React.FC<GeneratorFormProps> = ({ module, onSubmit, onBack, onShowAIAssistant, isLoading, generationProgress }) => {
  const [formData, setFormData] = useState<FormData>(() => {
    const defaultData: FormData = {
      jenjang: 'SMA',
      kelas: '', semester: '1', mata_pelajaran: '', 
      sekolah: 'SMA ISLAM AL-GHOZALI',
      tahun_ajaran: '2025-2026', nama_guru: '', fase: '',
      cp_elements: '', alokasi_waktu: '', jumlah_modul_ajar: 1,
      topik_materi: '', sertakan_kisi_kisi: true, sertakan_soal_tka: false,
      jumlah_soal_tka: 10, sertakan_soal_tka_uraian: false, jumlah_soal_tka_uraian: 5,
      kelompok_tka: 'saintek',
      jenis_soal: ['Pilihan Ganda', 'Uraian'], jumlah_pg: 30, jumlah_uraian: 4,
      jumlah_isian_singkat: 0, 
      soal_pesantren_sections: [],
      tingkat_kesulitan: 'Sedang', bahasa: 'Bahasa Indonesia',
      yayasan: 'YPI PONDOK MODERN AL-GHOZALI',
      alamat_sekolah: 'Jl. Permata No. 19 Curug Gunungsindur Kab. Bogor 16340',
      logo_sekolah: '',
      judul_asesmen: module === 'tryout' ? 'TRY OUT UJIAN AKHIR SEKOLAH' : 'PENILAIAN SUMATIF AKHIR SEMESTER GANJIL',
      tanggal_ujian: '',
      jam_ke: '', waktu_ujian: '90 Menit', use_thinking_mode: false,
    };
    try {
        const savedData = localStorage.getItem('guruAppData');
        if (savedData) return { ...defaultData, ...JSON.parse(savedData) };
    } catch (error) {}
    return defaultData;
  });
  
  const [showCustomSubject, setShowCustomSubject] = useState(false);
  const [customMataPelajaran, setCustomMataPelajaran] = useState<Record<string, string[]>>({});
  const [newSubject, setNewSubject] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const processedMilestones = useRef<Set<number>>(new Set());
  const [availableTeachers, setAvailableTeachers] = useState<string[]>([]);

  useEffect(() => {
    try {
        const savedCustomSubjects = localStorage.getItem('customMataPelajaran');
        if (savedCustomSubjects) setCustomMataPelajaran(JSON.parse(savedCustomSubjects));
    } catch (error) {}
  }, []);

  useEffect(() => {
    localStorage.setItem('customMataPelajaran', JSON.stringify(customMataPelajaran));
  }, [customMataPelajaran]);

  useEffect(() => {
    const { sekolah, nama_guru, yayasan, alamat_sekolah, jenjang, kelas, mata_pelajaran, tahun_ajaran, bahasa, semester } = formData;
    localStorage.setItem('guruAppData', JSON.stringify({ sekolah, nama_guru, yayasan, alamat_sekolah, jenjang, kelas, mata_pelajaran, tahun_ajaran, bahasa, semester }));
  }, [formData]);

  useEffect(() => {
    if (formData.jenjang) {
      setKelasOptions(KELAS_OPTIONS[formData.jenjang] || []);
      const baseSubjects = MATA_PELAJARAN_OPTIONS[formData.jenjang] || [];
      const customSubjectsForJenjang = customMataPelajaran[formData.jenjang] || [];
      const combinedSubjects = [...new Set([...baseSubjects, ...customSubjectsForJenjang])].sort();
      setMataPelajaranOptions(combinedSubjects);
      setAlokasiWaktuOptions(ALOKASI_WAKTU_OPTIONS[formData.jenjang] || []);
      setShowCustomSubject(false);
    }
  }, [formData.jenjang, customMataPelajaran]);

  // Effect to populate teacher suggestions based on Subject and Class
  useEffect(() => {
    const { mata_pelajaran, kelas } = formData;
    if (mata_pelajaran) {
        const subjectData = TEACHER_DATA.find(t => t.subject === mata_pelajaran);
        if (subjectData) {
            let teachers = subjectData.teachers;
            // Optionally filter by class if selected, or show all teachers for that subject
            // Strict filtering by class might be too restrictive if data is incomplete, but let's prioritize it
            if (kelas) {
                const classSpecificTeachers = teachers.filter(t => t.classes.includes(kelas));
                if (classSpecificTeachers.length > 0) {
                    teachers = classSpecificTeachers;
                }
            }
            const teacherNames = teachers.map(t => t.name);
            setAvailableTeachers(teacherNames);
            
            // Auto-select if only one teacher matches and no teacher is currently set (or if user switches subject)
            // To avoid overwriting user input too aggressively, we check if nama_guru is empty or was previously auto-set (hard to track)
            // Simple approach: if name is empty, auto-set.
            if (teacherNames.length === 1 && !formData.nama_guru) {
                 setFormData(prev => ({ ...prev, nama_guru: teacherNames[0] }));
            }
        } else {
            setAvailableTeachers([]);
        }
    } else {
        setAvailableTeachers([]);
    }
  }, [formData.mata_pelajaran, formData.kelas]);
  
  useEffect(() => {
    const { jenjang, kelas } = formData;
    let newFase = '';
    const kelasNum = parseInt(kelas, 10);
    if (jenjang === 'SMA') newFase = kelasNum === 10 ? 'Fase E' : 'Fase F';
    if (newFase !== formData.fase) setFormData(prev => ({ ...prev, fase: newFase }));
  }, [formData.jenjang, formData.kelas]);

  useEffect(() => {
    if (!isLoading) { setLogs([]); processedMilestones.current.clear(); return; }
    const steps = LOG_STEPS[module] || [];
    steps.forEach((step) => {
        if (generationProgress >= step.progress && !processedMilestones.current.has(step.progress)) {
            setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] > ${step.message}`]);
            processedMilestones.current.add(step.progress);
        }
    });
  }, [isLoading, generationProgress, module]);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  const [kelasOptions, setKelasOptions] = useState<string[]>([]);
  const [mataPelajaranOptions, setMataPelajaranOptions] = useState<string[]>([]);
  const [alokasiWaktuOptions, setAlokasiWaktuOptions] = useState<string[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setFormData(prev => ({...prev, [name]: checked }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'custom') {
        setShowCustomSubject(true);
        setFormData(prev => ({ ...prev, mata_pelajaran: '', nama_guru: '' })); // Reset teacher when custom subject
    }
    else { 
        setShowCustomSubject(false); 
        // Reset teacher if subject changes, to encourage re-selection from new list, unless user typed custom name
        setFormData(prev => ({ ...prev, mata_pelajaran: value, nama_guru: '' })); 
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => {
      const newJenisSoal = checked ? [...(prev.jenis_soal || []), name] : (prev.jenis_soal || []).filter(item => item !== name);
      return { ...prev, jenis_soal: newJenisSoal };
    });
  };

  const handleSaveNewSubject = () => {
    const trimmedSubject = newSubject.trim();
    if (trimmedSubject && formData.jenjang) {
        setCustomMataPelajaran(prev => ({ ...prev, [formData.jenjang]: [...(prev[formData.jenjang] || []), trimmedSubject] }));
        setFormData(prev => ({ ...prev, mata_pelajaran: trimmedSubject }));
        setShowCustomSubject(false);
        setNewSubject('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (module === 'soal') {
        const hasStandard = (formData.jenis_soal && formData.jenis_soal.length > 0);
        const hasTKA = formData.sertakan_soal_tka || formData.sertakan_soal_tka_uraian;
        if (!hasStandard && !hasTKA) { 
            alert("Pilih minimal satu jenis soal: Standar (PG/Uraian) atau TKA (PG/Essay)."); 
            return; 
        }
    } else if (module === 'tryout') {
        const selectedTypes = formData.jenis_soal || [];
        if (selectedTypes.length === 0) { 
            alert("Pilih minimal satu jenis soal."); 
            return; 
        }
    }
    
    onSubmit(formData);
  };

  const title = module === 'admin' ? 'Generator Administrasi Guru' : module === 'soal' ? 'Generator Bank Soal' : 'Generator Try Out & UAS';
  const description = module === 'admin' 
    ? 'Lengkapi form untuk menghasilkan ATP, Prota, Promes, Modul Ajar, KKTP, dan Jurnal Harian.' 
    : module === 'soal' ? 'Lengkapi form untuk menghasilkan bank soal dan perangkat asesmen adaptif.'
    : 'Lengkapi form untuk menghasilkan soal Try Out/UAS Komprehensif (Kelas 10-12) & Soal TKA.';
  const formElementClasses = "w-full rounded-md border-2 border-gray-300 focus:border-indigo-500 focus:ring-1 transition duration-150";

  return (
    <div className="bg-white rounded-lg card-shadow p-6 fade-in">
      <div className="mb-6">
        <button onClick={onBack} className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4">&larr; Dashboard</button>
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <p className="text-gray-600 mt-1">{description}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-4 gap-6">
          <select name="jenjang" value={formData.jenjang} onChange={handleChange} required className={formElementClasses}><option value="SMA">SMA</option></select>
          <select name="kelas" value={formData.kelas} onChange={handleChange} required className={formElementClasses}><option value="">Pilih Kelas</option>{kelasOptions.map(k => <option key={k} value={k}>{k}</option>)}</select>
          <select name="mata_pelajaran_select" value={showCustomSubject ? 'custom' : formData.mata_pelajaran} onChange={handleSubjectChange} required className={formElementClasses}><option value="">Pilih Mapel</option>{mataPelajaranOptions.map(m => <option key={m} value={m}>{m}</option>)}<option value="custom">Tambah Baru...</option></select>
          <select name="bahasa" value={formData.bahasa} onChange={handleChange} className={formElementClasses}><option>Bahasa Indonesia</option><option>Bahasa Inggris</option><option>Bahasa Arab</option></select>
        </div>
        {showCustomSubject && (
            <div className="flex items-center space-x-2"><input type="text" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} className={`flex-grow ${formElementClasses}`} placeholder="Nama mapel baru..." /><button type="button" onClick={handleSaveNewSubject} className="px-4 py-2 bg-green-600 text-white rounded-md">Simpan</button></div>
        )}
        <div className="grid md:grid-cols-2 gap-6">
            <select name="semester" value={formData.semester} onChange={handleChange} required className={formElementClasses}><option value="1">Semester 1 (Ganjil)</option><option value="2">Semester 2 (Genap)</option></select>
            <input type="text" name="tahun_ajaran" value={formData.tahun_ajaran} onChange={handleChange} required className={formElementClasses} placeholder="Tahun Ajaran" />
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <input type="text" name="sekolah" value={formData.sekolah} onChange={handleChange} required className={formElementClasses} placeholder="Nama Sekolah" />
          <div className="relative">
              <input 
                  list="teacher-list" 
                  type="text" 
                  name="nama_guru" 
                  value={formData.nama_guru} 
                  onChange={handleChange} 
                  required 
                  className={formElementClasses} 
                  placeholder="Nama Pengajar" 
                  autoComplete="off"
              />
              <datalist id="teacher-list">
                {availableTeachers.map((teacher, index) => (
                    <option key={index} value={teacher} />
                ))}
              </datalist>
          </div>
        </div>
        <hr/>

        {module === 'admin' && (
          <div className="space-y-6">
             <div className="grid md:grid-cols-3 gap-6">
                <select name="fase" value={formData.fase} onChange={handleChange} required className={formElementClasses}><option value="">Pilih Fase</option><option value="Fase E">Fase E (10 SMA)</option><option value="Fase F">Fase F (11-12 SMA)</option></select>
                <select name="alokasi_waktu" value={formData.alokasi_waktu} onChange={handleChange} required className={formElementClasses}><option value="">Alokasi Waktu</option>{alokasiWaktuOptions.map(aw => <option key={aw} value={aw}>{aw}</option>)}</select>
                <input type="number" name="jumlah_modul_ajar" value={formData.jumlah_modul_ajar} onChange={handleChange} required min="1" max="10" className={formElementClasses} placeholder="Jml Modul Ajar" />
            </div>
            <textarea name="cp_elements" id="cp_elements" value={formData.cp_elements ?? ''} onChange={handleChange} required rows={4} className={formElementClasses} placeholder="Elemen Capaian Pembelajaran (CP)..."></textarea>
            <button type="button" onClick={() => onShowAIAssistant(formData, 'cp')} className="text-sm text-blue-600 font-semibold">✨ Saran AI</button>
          </div>
        )}
        
        {(module === 'soal' || module === 'tryout') && (
           <div className="space-y-6">
                <div className="flex justify-between items-center mb-1">
                    <label htmlFor="topik_materi" className="block text-sm font-medium text-gray-700">
                        {module === 'tryout' ? 'Daftar Materi Kumulatif (Kelas 10, 11, 12)' : 'Topik / Materi Spesifik'}
                    </label>
                    <button type="button" onClick={() => onShowAIAssistant(formData, 'topic')} className="text-sm text-blue-600 font-semibold flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.047a1 1 0 01.897.95l.407 8.14a1 1 0 00.95.95l8.14.407a1 1 0 01.95.897 1 1 0 01-.95.897l-8.14.407a1 1 0 00-.95.95l-.407 8.14a1 1 0 01-.897.95 1 1 0 01-.897-.95l-.407-8.14a1 1 0 00-.95-.95l-8.14-.407a1 1 0 01-.95-.897 1 1 0 01.95-.897l8.14-.407a1 1 0 00.95-.95l.407-8.14a1 1 0 01.897-.95z" clipRule="evenodd" /></svg>
                        ✨ Saran AI
                    </button>
                </div>
                <textarea 
                    name="topik_materi" 
                    id="topik_materi"
                    value={formData.topik_materi ?? ''} 
                    onChange={handleChange} 
                    required 
                    rows={module === 'tryout' ? 5 : 3} 
                    className={formElementClasses} 
                    placeholder={module === 'tryout' 
                        ? "Masukkan materi-materi utama yang akan diujikan dari kelas 10 sampai 12 (Contoh: Aljabar, Trigonometri, Kalkulus...)" 
                        : "Masukkan topik atau materi spesifik yang ingin dibuatkan soalnya..."}
                ></textarea>

                {module === 'soal' && (
                    <>
                        <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                            <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Soal Mata Pelajaran (Standar)</h4>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="flex items-center space-x-2 mb-2 cursor-pointer">
                                        <input type="checkbox" name="Pilihan Ganda" checked={formData.jenis_soal?.includes('Pilihan Ganda')} onChange={handleCheckboxChange} className="rounded text-indigo-600 focus:ring-indigo-500"/> 
                                        <span className="font-medium text-gray-700">Pilihan Ganda (PG)</span>
                                    </label>
                                    {formData.jenis_soal?.includes('Pilihan Ganda') && (
                                        <input type="number" name="jumlah_pg" value={formData.jumlah_pg} onChange={handleChange} className={formElementClasses} placeholder="Jml Soal PG" min="1" />
                                    )}
                                </div>
                                <div>
                                    <label className="flex items-center space-x-2 mb-2 cursor-pointer">
                                        <input type="checkbox" name="Uraian" checked={formData.jenis_soal?.includes('Uraian')} onChange={handleCheckboxChange} className="rounded text-indigo-600 focus:ring-indigo-500"/> 
                                        <span className="font-medium text-gray-700">Uraian / Essay</span>
                                    </label>
                                    {formData.jenis_soal?.includes('Uraian') && (
                                        <input type="number" name="jumlah_uraian" value={formData.jumlah_uraian} onChange={handleChange} className={formElementClasses} placeholder="Jml Soal Essay" min="1" />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-amber-50 p-4 rounded-md border border-amber-200">
                            <h4 className="text-sm font-bold text-amber-800 uppercase tracking-wide mb-3 flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                Soal Tambahan: TKA (Tes Potensi Akademik)
                            </h4>
                            <div className="grid md:grid-cols-2 gap-6 mb-4">
                                <div>
                                    <label className="flex items-center space-x-2 mb-2 cursor-pointer">
                                        <input type="checkbox" name="sertakan_soal_tka" checked={!!formData.sertakan_soal_tka} onChange={handleChange} className="rounded text-amber-600 focus:ring-amber-500"/> 
                                        <span className="font-medium text-gray-700">PG TKA</span>
                                    </label>
                                    {formData.sertakan_soal_tka && (
                                        <input type="number" name="jumlah_soal_tka" value={formData.jumlah_soal_tka} onChange={handleChange} className={`${formElementClasses} border-amber-300 focus:ring-amber-500 focus:border-amber-500`} placeholder="Jml PG TKA" min="1" />
                                    )}
                                </div>
                                <div>
                                    <label className="flex items-center space-x-2 mb-2 cursor-pointer">
                                        <input type="checkbox" name="sertakan_soal_tka_uraian" checked={!!formData.sertakan_soal_tka_uraian} onChange={handleChange} className="rounded text-amber-600 focus:ring-amber-500"/> 
                                        <span className="font-medium text-gray-700">Essay TKA</span>
                                    </label>
                                    {formData.sertakan_soal_tka_uraian && (
                                        <input type="number" name="jumlah_soal_tka_uraian" value={formData.jumlah_soal_tka_uraian} onChange={handleChange} className={`${formElementClasses} border-amber-300 focus:ring-amber-500 focus:border-amber-500`} placeholder="Jml Essay TKA" min="1" />
                                    )}
                                </div>
                            </div>
                            
                            {(formData.sertakan_soal_tka || formData.sertakan_soal_tka_uraian) && (
                                <div>
                                    <label className="block text-sm font-medium text-amber-900 mb-1">Kelompok TKA</label>
                                    <select name="kelompok_tka" value={formData.kelompok_tka} onChange={handleChange} className={`${formElementClasses} border-amber-300 focus:ring-amber-500 focus:border-amber-500`}>
                                        <option value="saintek">Saintek (Sains & Teknologi)</option>
                                        <option value="soshum">Soshum (Sosial & Humaniora)</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tingkat Kesulitan</label>
                                <select name="tingkat_kesulitan" value={formData.tingkat_kesulitan} onChange={handleChange} className={formElementClasses}>
                                    <option>Mudah</option>
                                    <option>Sedang</option>
                                    <option>Sulit (HOTS)</option>
                                </select>
                            </div>
                        </div>
                    </>
                )}

                {module === 'tryout' && (
                    <div className="space-y-6">
                        <div className="p-4 bg-amber-50 border-l-4 border-amber-500 text-amber-800">
                            <p className="font-bold">Konfigurasi Try Out / UAS</p>
                            <p className="text-sm">Tentukan jumlah soal untuk setiap kategori di bawah ini.</p>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Soal Standar</label>
                                <div className="grid grid-cols-2 gap-2">
                                     <input type="number" name="jumlah_pg" value={formData.jumlah_pg} onChange={handleChange} className={formElementClasses} placeholder="Jml PG" />
                                     <input type="number" name="jumlah_uraian" value={formData.jumlah_uraian} onChange={handleChange} className={formElementClasses} placeholder="Jml Essay" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Soal TKA (Akademik)</label>
                                <div className="grid grid-cols-2 gap-2">
                                     <input type="number" name="jumlah_soal_tka" value={formData.jumlah_soal_tka} onChange={handleChange} className={formElementClasses} placeholder="Jml PG TKA" />
                                     <input type="number" name="jumlah_soal_tka_uraian" value={formData.jumlah_soal_tka_uraian} onChange={handleChange} className={formElementClasses} placeholder="Jml Essay TKA" />
                                </div>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <select name="kelompok_tka" value={formData.kelompok_tka} onChange={handleChange} className={formElementClasses}>
                                <option value="saintek">Kelompok Saintek</option>
                                <option value="soshum">Kelompok Soshum</option>
                            </select>
                            <select name="tingkat_kesulitan" value={formData.tingkat_kesulitan} onChange={handleChange} className={formElementClasses}>
                                <option>Mudah</option>
                                <option>Sedang</option>
                                <option>Sulit (HOTS)</option>
                            </select>
                        </div>

                        <div className="flex flex-wrap gap-4">
                            <label className="flex items-center space-x-2"><input type="checkbox" name="Pilihan Ganda" checked={formData.jenis_soal?.includes('Pilihan Ganda')} onChange={handleCheckboxChange}/> <span>Sertakan PG</span></label>
                            <label className="flex items-center space-x-2"><input type="checkbox" name="Uraian" checked={formData.jenis_soal?.includes('Uraian')} onChange={handleCheckboxChange}/> <span>Sertakan Essay</span></label>
                        </div>
                    </div>
                )}
           </div>
        )}

        <div className="p-4 bg-gray-100 rounded-lg flex items-center justify-between">
            <span className="font-semibold text-gray-700">🧠 Mode Cerdas (HOTS)</span> 
            <input type="checkbox" name="use_thinking_mode" checked={!!formData.use_thinking_mode} onChange={handleChange} className="toggle toggle-primary" />
        </div>

        {isLoading && (
            <div className="my-4">
                <div className="flex justify-between mb-1"><span className="font-medium text-indigo-700">AI Sedang Bekerja...</span><span className="font-medium text-indigo-700">{Math.round(generationProgress)}%</span></div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4"><div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${generationProgress}%` }}></div></div>
                <div className="bg-gray-900 rounded-md p-4 h-32 overflow-y-auto font-mono text-xs text-green-400">
                    {logs.map((log, i) => <p key={i}>{log}</p>)}
                    <div ref={logsEndRef} />
                </div>
            </div>
        )}

        <div className="flex justify-end pt-2">
            <button type="submit" disabled={isLoading} className="px-6 py-2 border rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400">
                {isLoading ? <Spinner /> : 'Generate'}
            </button>
        </div>
      </form>
    </div>
  );
};

export default GeneratorForm;
