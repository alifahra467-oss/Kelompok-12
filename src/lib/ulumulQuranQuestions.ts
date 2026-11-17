import type { Course, QuestionPrivate, Topic } from '../types/arena';

export const ULUMUL_QURAN_COURSE: Omit<Course, 'updatedAt'> = {
  courseId: 'main',
  title: '‘Ulûmul Qur’ân (Ilmu-Ilmu Al-Qur’an)',
  description:
    'Kajian pondasi dasar ‘Ulûmul Qur’ân meliputi Bab Asbabun Nuzul, Turunnya Al-Qur’an (Nuzulul Qur’an), Pengumpulan dan Penyusunan Al-Qur’an, serta Turunnya Al-Qur’an dalam Tujuh Huruf (Sab‘atu Ahruf).',
  lecturerName: 'Admin Pembelajaran',
  semester: '2026/2027',
  logoUrl: '/src/assets/images/course_emblem_sirah_1794722950872.jpg',
};

export const ULUMUL_QURAN_TOPICS: Topic[] = [
  {
    topicId: 'topic_uq_asbab',
    name: 'Asbabun Nuzul',
    description:
      'Pengertian, syarat masa turunnya wahyu, pedoman riwayat shahih, kaidah umum lafaz, serta redaksi riwayat.',
    subtopics: ['Definisi & Batasan Waktu', 'Pedoman Riwayat', 'Kaidah Umum Lafaz', 'Redaksi Riwayat'],
    orderIndex: 1,
  },
  {
    topicId: 'topic_uq_nuzul',
    name: 'Turunnya Al-Qur’an',
    description:
      'Tahapan turunnya Al-Qur’an, perbedaan Inzal dan Tanzil, serta hikmah turun secara bertahap.',
    subtopics: ['Lauhul Mahfuzh & Baitul ‘Izzah', 'Inzal vs Tanzil', 'Hikmah Turun Bertahap', 'Pentahapan Hukum'],
    orderIndex: 2,
  },
  {
    topicId: 'topic_uq_jam',
    name: 'Pengumpulan & Penyusunan Al-Qur’an',
    description:
      'Pengumpulan Al-Qur’an pada masa Abu Bakar Ash-Shiddiq dan Utsman bin Affan, serta sifat urutan ayat.',
    subtopics: ['Masa Abu Bakar & Yamamah', 'Syarat Zaid bin Tsabit', 'Mushaf Utsmani', 'Urutan Ayat Tauqifi'],
    orderIndex: 3,
  },
  {
    topicId: 'topic_uq_ahruf',
    name: 'Tujuh Huruf (Sab‘atu Ahruf)',
    description:
      'Tujuan keringanan tujuh huruf, pengertian menurut pendapat terkuat, dan perbedaannya dengan Qira’at Sab‘ah.',
    subtopics: ['Alasan Keringanan', 'Pengertian Tujuh Huruf', 'Tujuh Huruf vs Qira’at Sab‘ah'],
    orderIndex: 4,
  },
];

export const ULUMUL_QURAN_QUESTIONS: Array<Omit<QuestionPrivate, 'createdAt' | 'updatedAt'>> = [
  {
    questionId: 'uq_q_01',
    topicId: 'topic_uq_asbab',
    topicName: 'Asbabun Nuzul',
    subtopic: 'Definisi & Batasan Waktu',
    type: 'MULTIPLE_CHOICE',
    questionText:
      'Dari pengertian Asbabun Nuzul, peristiwa manakah yang BUKAN termasuk sebab turunnya ayat yang terjadi sebelum masa kenabian Muhammadﷺ?',
    options: [
      'Kisah pasukan bergajah (Ashabul Fil) dalam QS. Al-Fil',
      'Pertanyaan para sahabat kepada Nabi ﷺ tentang suatu hukum',
      'Perselisihan sahabat yang terjadi saat masa turunnya wahyu',
      'Pertanyaan kaum Yahudi kepada Nabi ﷺ di Madinah',
    ],
    correctAnswer: 'Kisah pasukan bergajah (Ashabul Fil) dalam QS. Al-Fil',
    explanation:
      'Asbabun Nuzul harus berupa peristiwa atau pertanyaan yang terjadi pada masa turunnya Al-Qur’an (zaman kenabian Muhammad ﷺ). Kisah pasukan bergajah terjadi sebelum Nabi ﷺ lahir/diutus, sehingga termasuk kisah umat terdahulu dan bukan Asbabun Nuzul.',
    reference:
      'Manna Al-Qaththan, Pengantar Studi Ilmu Al-Qur’an, Bab 6 (Asbabun Nuzul); H. Sardana, Pondasi Dasar Memahami ‘Ulûmul Qur’ân, Bab VI',
    difficulty: 'MUDAH',
    points: 10,
    timeLimitSec: 45,
    enabledModes: ['CERDAS_CERMAT', 'PAPAN_TANTANGAN'],
    isActive: true,
    isDemo: false,
  },
  {
    questionId: 'uq_q_02',
    topicId: 'topic_uq_asbab',
    topicName: 'Asbabun Nuzul',
    subtopic: 'Pedoman Riwayat',
    type: 'MULTIPLE_CHOICE',
    questionText:
      'Berdasarkan kesepakatan ulama, melalui jalur apakah Asbabun Nuzul dapat diketahui secara sah?',
    options: [
      'Riwayat shahih dari sahabat yang menyaksikan langsung turunnya ayat',
      'Ijtihad dan penalaran akal semata tanpa sanad riwayat',
      'Penyesuaian dengan kondisi sosial masyarakat masa kini',
      'Perbandingan dengan kisah-kisah umat sebelum Islam',
    ],
    correctAnswer: 'Riwayat shahih dari sahabat yang menyaksikan langsung turunnya ayat',
    explanation:
      'Para ulama sepakat bahwa mengetahui Asbabun Nuzul tidak boleh dengan tebakan atau akal semata, tetapi wajib bersumber dari riwayat shahih para sahabat yang menyaksikan langsung peristiwa turunnya ayat.',
    reference:
      'Manna Al-Qaththan, Pengantar Studi Ilmu Al-Qur’an, Bab 6 (Pedoman Mengetahui Asbabun Nuzul); H. Sardana, Bab VI',
    difficulty: 'MUDAH',
    points: 10,
    timeLimitSec: 45,
    enabledModes: ['CERDAS_CERMAT', 'PAPAN_TANTANGAN'],
    isActive: true,
    isDemo: false,
  },
  {
    questionId: 'uq_q_03',
    topicId: 'topic_uq_asbab',
    topicName: 'Asbabun Nuzul',
    subtopic: 'Kaidah Umum Lafaz',
    type: 'MULTIPLE_CHOICE',
    questionText:
      'Suatu ayat turun karena kasus khusus, namun redaksi lafaznya bersifat umum. Bagaimana pemberlakuan hukumnya menurut jumhur ulama?',
    options: [
      'Berlaku umum sesuai keumuman lafaznya (Al-‘ibrah bi ‘umumil lafzhi)',
      'Hanya berlaku khusus bagi pelaku peristiwa tersebut',
      'Hukumnya gugur setelah sahabat yang bersangkutan wafat',
      'Tidak dapat diterapkan pada kasus serupa setelah masa Nabi ﷺ',
    ],
    correctAnswer: 'Berlaku umum sesuai keumuman lafaznya (Al-‘ibrah bi ‘umumil lafzhi)',
    explanation:
      'Mayoritas ulama berpegang pada kaidah Al-‘ibrah bi ‘umumil lafzhi la bi khushushis sabab: yang menjadi patokan hukum adalah keumuman lafaz ayat, bukan kekhususan peristiwanya. Karena itu hukum Li’an dan Zhihar berlaku untuk semua umat Islam.',
    reference:
      'Manna Al-Qaththan, Pengantar Studi Ilmu Al-Qur’an, Bab 6 (Kaidah Al-‘Ibrah); H. Sardana, Bab VI',
    difficulty: 'SEDANG',
    points: 10,
    timeLimitSec: 45,
    enabledModes: ['CERDAS_CERMAT', 'PAPAN_TANTANGAN'],
    isActive: true,
    isDemo: false,
  },
  {
    questionId: 'uq_q_04',
    topicId: 'topic_uq_asbab',
    topicName: 'Asbabun Nuzul',
    subtopic: 'Redaksi Riwayat',
    type: 'MULTIPLE_CHOICE',
    questionText:
      'Bila terdapat dua riwayat shahih: satu memakai redaksi tegas ("Maka turunlah ayat...") dan satu lagi memakai redaksi ("Ayat ini turun mengenai..."), manakah yang ditetapkan sebagai Asbabun Nuzul?',
    options: [
      'Riwayat beredaksi tegas (sharih), sedangkan riwayat kedua dipahami sebagai tafsir makna',
      'Keduanya ditolak karena dinilai saling bertentangan',
      'Riwayat kedua didahulukan karena maknanya lebih luas',
      'Ayat tersebut dihukumi turun berulang kali tanpa perlu tarjih',
    ],
    correctAnswer:
      'Riwayat beredaksi tegas (sharih), sedangkan riwayat kedua dipahami sebagai tafsir makna',
    explanation:
      'Ungkapan "Ayat ini turun mengenai..." bisa bermakna sebab turunnya ayat atau sekadar penjelasan isi ayat. Karena itu, jika bertemu riwayat shahih yang tegas menyatakan "Maka turunlah ayat...", riwayat tegas itulah yang ditetapkan sebagai Asbabun Nuzul.',
    reference:
      'Manna Al-Qaththan, Pengantar Studi Ilmu Al-Qur’an, Bab 6 (Redaksi dan Berbilangnya Riwayat); H. Sardana, Bab VI',
    difficulty: 'SEDANG',
    points: 10,
    timeLimitSec: 45,
    enabledModes: ['CERDAS_CERMAT', 'PAPAN_TANTANGAN'],
    isActive: true,
    isDemo: false,
  },
  {
    questionId: 'uq_q_05',
    topicId: 'topic_uq_nuzul',
    topicName: 'Turunnya Al-Qur’an',
    subtopic: 'Lauhul Mahfuzh & Baitul ‘Izzah',
    type: 'MULTIPLE_CHOICE',
    questionText:
      'Menurut jumhur ulama berdasarkan riwayat Ibnu Abbas رضي الله عنهما, bagaimana dua tahapan turunnya Al-Qur’an?',
    options: [
      'Turun sekaligus ke Baitul ‘Izzah pada Lailatul Qadar, lalu bertahap kepada Nabi ﷺ selama ±23 tahun',
      'Turun sekaligus 30 juz langsung kepada Nabi ﷺ dalam satu malam di Gua Hira',
      'Turun bertahap ke Lauhul Mahfuzh tanpa pernah singgah di langit dunia',
      'Turun sekaligus dalam bentuk mushaf tertulis lengkap sebagaimana Taurat',
    ],
    correctAnswer:
      'Turun sekaligus ke Baitul ‘Izzah pada Lailatul Qadar, lalu bertahap kepada Nabi ﷺ selama ±23 tahun',
    explanation:
      'Jumhur ulama menjelaskan dua tahap: pertama, Al-Qur’an diturunkan sekaligus dari Lauhul Mahfuzh ke Baitul ‘Izzah (langit dunia) pada malam Lailatul Qadar. Kedua, diturunkan secara berangsur-angsur kepada Nabi Muhammad ﷺ melalui Jibril selama ±23 tahun.',
    reference:
      'Manna Al-Qaththan, Pengantar Studi Ilmu Al-Qur’an, Bab 7 (Turunnya Al-Qur’an); H. Sardana, Bab IV',
    difficulty: 'MUDAH',
    points: 10,
    timeLimitSec: 45,
    enabledModes: ['CERDAS_CERMAT', 'PAPAN_TANTANGAN'],
    isActive: true,
    isDemo: false,
  },
  {
    questionId: 'uq_q_06',
    topicId: 'topic_uq_nuzul',
    topicName: 'Turunnya Al-Qur’an',
    subtopic: 'Inzal vs Tanzil',
    type: 'MULTIPLE_CHOICE',
    questionText:
      'Apa perbedaan makna antara istilah Tanzil (تَنْزِيلٌ) dan Inzal (إِنْزَالٌ) dalam kajian Nuzulul Qur’an?',
    options: [
      'Tanzil berarti turun secara bertahap, sedangkan Inzal bermakna turun secara umum (termasuk sekaligus)',
      'Inzal khusus untuk ayat Madaniyah, sedangkan Tanzil khusus untuk ayat Makkiyah',
      'Tanzil berarti wahyu melalui mimpi, sedangkan Inzal melalui Malaikat Jibril',
      'Keduanya sama-sama berarti turun sekaligus dalam bentuk kitab tertulis',
    ],
    correctAnswer:
      'Tanzil berarti turun secara bertahap, sedangkan Inzal bermakna turun secara umum (termasuk sekaligus)',
    explanation:
      'Menurut Ar-Raghib Al-Ashfahani, kata Tanzil menunjukkan proses turun secara berangsur-angsur dan bertahap, sedangkan Inzal menunjukkan makna turun secara umum, baik sekaligus maupun bertahap.',
    reference: 'Manna Al-Qaththan, Pengantar Studi Ilmu Al-Qur’an, Bab 7 (Perbedaan antara Inzal dan Tanzil)',
    difficulty: 'SEDANG',
    points: 10,
    timeLimitSec: 45,
    enabledModes: ['CERDAS_CERMAT', 'PAPAN_TANTANGAN'],
    isActive: true,
    isDemo: false,
  },
  {
    questionId: 'uq_q_07',
    topicId: 'topic_uq_nuzul',
    topicName: 'Turunnya Al-Qur’an',
    subtopic: 'Hikmah Turun Bertahap',
    type: 'MULTIPLE_CHOICE',
    questionText:
      'Berdasarkan QS. Al-Furqan ayat 32, apakah hikmah utama Al-Qur’an diturunkan secara berangsur-angsur?',
    options: [
      'Meneguhkan hati Rasulullah ﷺ dalam menghadapi tantangan dakwah',
      'Mempercepat penulisan mushaf sebelum hijrah ke Madinah',
      'Menyamakan cara turunnya dengan kitab Taurat Nabi Musa',
      'Mengurangi beban hafalan para sahabat terhadap ayat Al-Qur’an',
    ],
    correctAnswer: 'Meneguhkan hati Rasulullah ﷺ dalam menghadapi tantangan dakwah',
    explanation:
      'Dalam QS. Al-Furqan: 32 ("kadzalika linutsabbita bihi fu’adaka"), hikmah utama turunnya Al-Qur’an secara bertahap adalah menguatkan dan memantapkan hati Nabi ﷺ ketika menghadapi penentangan kaum musyrikin, sekaligus memudahkan umat menghafal dan memahaminya.',
    reference:
      'Manna Al-Qaththan, Pengantar Studi Ilmu Al-Qur’an, Bab 7 (Hikmah Turunnya Al-Qur’an Secara Bertahap); H. Sardana, Bab IV',
    difficulty: 'MUDAH',
    points: 10,
    timeLimitSec: 45,
    enabledModes: ['CERDAS_CERMAT', 'PAPAN_TANTANGAN'],
    isActive: true,
    isDemo: false,
  },
  {
    questionId: 'uq_q_08',
    topicId: 'topic_uq_nuzul',
    topicName: 'Turunnya Al-Qur’an',
    subtopic: 'Pentahapan Hukum',
    type: 'MULTIPLE_CHOICE',
    questionText:
      'Manakah contoh syariat yang paling jelas menggambarkan pentahapan hukum (tadarruj) dalam turunnya Al-Qur’an?',
    options: [
      'Pengharaman khamr yang ditetapkan bertahap melalui empat rangkaian ayat',
      'Kewajiban shalat lima waktu yang diturunkan dalam empat tahap terpisah',
      'Larangan riba yang langsung diharamkan mutlak pada wahyu pertama',
      'Pemindahan arah kiblat ke Ka’bah yang turun bertahap dalam empat surat',
    ],
    correctAnswer: 'Pengharaman khamr yang ditetapkan bertahap melalui empat rangkaian ayat',
    explanation:
      'Kebiasaan minum khamr sangat melekat di masyarakat Arab kala itu, sehingga Allah mengharamkannya dalam empat tahap: QS. An-Nahl: 67, QS. Al-Baqarah: 219, QS. An-Nisa’: 43, hingga pengharaman tegas pada QS. Al-Ma’idah: 90–91.',
    reference:
      'Manna Al-Qaththan, Pengantar Studi Ilmu Al-Qur’an, Bab 7 (Sejalan dengan Peristiwa dan Pentahapan Hukum)',
    difficulty: 'MUDAH',
    points: 10,
    timeLimitSec: 45,
    enabledModes: ['CERDAS_CERMAT', 'PAPAN_TANTANGAN'],
    isActive: true,
    isDemo: false,
  },
  {
    questionId: 'uq_q_09',
    topicId: 'topic_uq_jam',
    topicName: 'Pengumpulan & Penyusunan Al-Qur’an',
    subtopic: 'Masa Abu Bakar & Yamamah',
    type: 'MULTIPLE_CHOICE',
    questionText:
      'Peristiwa apakah yang melatarbelakangi usulan Umar bin Khaththab kepada Khalifah Abu Bakar untuk mengumpulkan Al-Qur’an?',
    options: [
      'Gugurnya sekitar 70 sahabat penghafal Al-Qur’an dalam Perang Yamamah',
      'Perselisihan bacaan antara pasukan Syam dan Irak di front Armenia',
      'Hilangnya catatan wahyu yang disimpan di rumah Hafshah binti Umar',
      'Banyaknya mualaf non-Arab yang kesulitan membaca tulisan tanpa tanda titik',
    ],
    correctAnswer: 'Gugurnya sekitar 70 sahabat penghafal Al-Qur’an dalam Perang Yamamah',
    explanation:
      'Pada Perang Yamamah (12 H), sekitar 70 sahabat penghafal Al-Qur’an (qurra’) gugur syahid. Umar khawatir Al-Qur’an akan banyak hilang jika para penghafalnya wafat, sehingga ia mengusulkan kepada Abu Bakar untuk menghimpunnya, dan tugas itu diberikan kepada Zaid bin Tsabit.',
    reference:
      'Manna Al-Qaththan, Pengantar Studi Ilmu Al-Qur’an, Bab 8 (Pengumpulan Al-Qur’an Masa Abu Bakar); H. Sardana, Bab V',
    difficulty: 'MUDAH',
    points: 10,
    timeLimitSec: 45,
    enabledModes: ['CERDAS_CERMAT', 'PAPAN_TANTANGAN'],
    isActive: true,
    isDemo: false,
  },
  {
    questionId: 'uq_q_10',
    topicId: 'topic_uq_jam',
    topicName: 'Pengumpulan & Penyusunan Al-Qur’an',
    subtopic: 'Syarat Zaid bin Tsabit',
    type: 'MULTIPLE_CHOICE',
    questionText:
      'Dalam penghimpunan Al-Qur’an masa Abu Bakar, selain hafalan, syarat mutlak apa yang ditetapkan Zaid bin Tsabit untuk menerima catatan ayat?',
    options: [
      'Didukung dua orang saksi bahwa ayat itu ditulis langsung di hadapan Nabi ﷺ',
      'Disetujui oleh sepuluh kepala suku di Madinah dan Makkah',
      'Disaksikan oleh satu orang tabi’in yang bermukim di Madinah',
      'Berdasarkan catatan pribadi penulis tanpa perlu kesaksian sahabat lain',
    ],
    correctAnswer: 'Didukung dua orang saksi bahwa ayat itu ditulis langsung di hadapan Nabi ﷺ',
    explanation:
      'Zaid bin Tsabit mensyaratkan bukti ganda berupa hafalan sekaligus catatan tertulis yang disaksikan oleh dua orang saksi bahwa naskah tersebut ditulis di hadapan Rasulullah ﷺ (kecuali dua ayat terakhir QS. At-Taubah yang kesaksian Abu Khuzaimah disamakan dengan dua saksi).',
    reference:
      'Manna Al-Qaththan, Pengantar Studi Ilmu Al-Qur’an, Bab 8; H. Sardana, Pondasi Dasar Memahami ‘Ulûmul Qur’ân, Bab V',
    difficulty: 'MUDAH',
    points: 10,
    timeLimitSec: 45,
    enabledModes: ['CERDAS_CERMAT', 'PAPAN_TANTANGAN'],
    isActive: true,
    isDemo: false,
  },
  {
    questionId: 'uq_q_11',
    topicId: 'topic_uq_jam',
    topicName: 'Pengumpulan & Penyusunan Al-Qur’an',
    subtopic: 'Mushaf Utsmani',
    type: 'MULTIPLE_CHOICE',
    questionText:
      'Apa instruksi Khalifah Utsman bin Affan kepada tim penyalin mushaf apabila terjadi perbedaan pendapat dalam penulisan kata?',
    options: [
      'Menuliskannya sesuai dialek Quraisy karena Al-Qur’an turun dengan bahasa mereka',
      'Menuliskannya memakai dialek Syam atau Irak sesuai pilihan pasukan',
      'Mencantumkan seluruh variasi dialek Arab pada setiap baris mushaf',
      'Menyerahkan penentuan ejaan kepada masing-masing gubernur wilayah',
    ],
    correctAnswer: 'Menuliskannya sesuai dialek Quraisy karena Al-Qur’an turun dengan bahasa mereka',
    explanation:
      'Utsman berpesan kepada anggota tim dari suku Quraisy: jika berselisih pendapat dengan Zaid bin Tsabit mengenai tulisan kata Al-Qur’an, tulislah dengan bahasa Quraisy karena Al-Qur’an diturunkan dengan bahasa mereka.',
    reference:
      'Manna Al-Qaththan, Pengantar Studi Ilmu Al-Qur’an, Bab 8 (Pengumpulan Al-Qur’an Masa Utsman); H. Sardana, Bab V',
    difficulty: 'MUDAH',
    points: 10,
    timeLimitSec: 45,
    enabledModes: ['CERDAS_CERMAT', 'PAPAN_TANTANGAN'],
    isActive: true,
    isDemo: false,
  },
  {
    questionId: 'uq_q_12',
    topicId: 'topic_uq_jam',
    topicName: 'Pengumpulan & Penyusunan Al-Qur’an',
    subtopic: 'Urutan Ayat Tauqifi',
    type: 'MULTIPLE_CHOICE',
    questionText:
      'Bagaimana kedudukan susunan dan urutan ayat-ayat dalam setiap surat Al-Qur’an menurut ijma’ ulama?',
    options: [
      'Bersifat Tauqifi, ditetapkan langsung oleh Nabi ﷺ atas petunjuk Jibril',
      'Hasil ijtihad panitia Utsman bin Affan berdasarkan panjang pendeknya ayat',
      'Diurutkan secara kronologis dari ayat pertama hingga ayat terakhir turun',
      'Disusun berdasarkan abjad awal ayat pada generasi setelah sahabat',
    ],
    correctAnswer: 'Bersifat Tauqifi, ditetapkan langsung oleh Nabi ﷺ atas petunjuk Jibril',
    explanation:
      'Para ulama sepakat (ijma’) bahwa urutan ayat dalam setiap surat adalah tauqifi: langsung ditentukan oleh Rasulullah ﷺ sesuai petunjuk Malaikat Jibril, bukan hasil pemikiran sahabat.',
    reference:
      'Manna Al-Qaththan, Pengantar Studi Ilmu Al-Qur’an, Bab 8 (Tertib Ayat dan Surat); H. Sardana, Bab V',
    difficulty: 'MUDAH',
    points: 10,
    timeLimitSec: 45,
    enabledModes: ['CERDAS_CERMAT', 'PAPAN_TANTANGAN'],
    isActive: true,
    isDemo: false,
  },
  {
    questionId: 'uq_q_13',
    topicId: 'topic_uq_ahruf',
    topicName: 'Tujuh Huruf (Sab‘atu Ahruf)',
    subtopic: 'Alasan Keringanan',
    type: 'MULTIPLE_CHOICE',
    questionText:
      'Berdasarkan hadis Ubay bin Ka’ab, mengapa Rasulullah ﷺ memohon keringanan agar Al-Qur’an diturunkan dalam tujuh huruf (Sab‘atu Ahruf)?',
    options: [
      'Untuk memudahkan umat yang ummi, terdiri dari lansia, anak-anak, dan hamba sahaya',
      'Karena Al-Qur’an wajib diterjemahkan ke dalam tujuh bahasa kerajaan lain',
      'Agar setiap kabilah bebas mengubah hukum ayat sesuai adat masing-masing',
      'Karena surat-surat terpanjang dalam Al-Qur’an berjumlah tujuh surat',
    ],
    correctAnswer: 'Untuk memudahkan umat yang ummi, terdiri dari lansia, anak-anak, dan hamba sahaya',
    explanation:
      'Rasulullah ﷺ memohon keringanan kepada Jibril karena umatnya merupakan masyarakat yang ummi—terdapat kakek-kakek, nenek-nenek, anak-anak, dan hamba sahaya yang kesulitan jika hanya diwajibkan satu cara bacaan/dialek saja.',
    reference:
      'Manna Al-Qaththan, Pengantar Studi Ilmu Al-Qur’an, Bab 9 (Turunnya Al-Qur’an dengan Tujuh Huruf)',
    difficulty: 'MUDAH',
    points: 10,
    timeLimitSec: 45,
    enabledModes: ['CERDAS_CERMAT', 'PAPAN_TANTANGAN'],
    isActive: true,
    isDemo: false,
  },
  {
    questionId: 'uq_q_14',
    topicId: 'topic_uq_ahruf',
    topicName: 'Tujuh Huruf (Sab‘atu Ahruf)',
    subtopic: 'Pengertian Tujuh Huruf',
    type: 'MULTIPLE_CHOICE',
    questionText:
      'Menurut pendapat terkuat para ulama, apakah yang dimaksud dengan "Tujuh Huruf" (Sab‘atu Ahruf)?',
    options: [
      'Tujuh variasi bahasa/dialek Arab yang berbeda lafaznya namun satu maknanya',
      'Tujuh tingkatan makna batin yang hanya diketahui ulama tertentu',
      'Tujuh jenis tanda baca harakat dan titik pada huruf hijaiyah',
      'Kiasan untuk jumlah yang banyak, bukan bilangan tujuh yang sebenarnya',
    ],
    correctAnswer: 'Tujuh variasi bahasa/dialek Arab yang berbeda lafaznya namun satu maknanya',
    explanation:
      'Pendapat paling kuat menyatakan bahwa Tujuh Huruf adalah tujuh ragam ungkapan/dialek dari bahasa Arab yang artinya sama (seperti kata halumma, ta’al, dan aqbil yang semuanya berarti "kemarilah"), selama tidak mencampur ayat rahmat dengan azab.',
    reference:
      'Manna Al-Qaththan, Pengantar Studi Ilmu Al-Qur’an, Bab 9 (Pengertian Tujuh Huruf)',
    difficulty: 'SEDANG',
    points: 10,
    timeLimitSec: 45,
    enabledModes: ['CERDAS_CERMAT', 'PAPAN_TANTANGAN'],
    isActive: true,
    isDemo: false,
  },
  {
    questionId: 'uq_q_15',
    topicId: 'topic_uq_ahruf',
    topicName: 'Tujuh Huruf (Sab‘atu Ahruf)',
    subtopic: 'Tujuh Huruf vs Qira’at Sab‘ah',
    type: 'MULTIPLE_CHOICE',
    questionText:
      'Apakah "Tujuh Huruf" (Sab‘atu Ahruf) identik dengan "Qira’at Sab‘ah" (Tujuh Imam Qira’at)?',
    options: [
      'Tidak; Qira’at Sab‘ah diseleksi pada abad ke-3 H dalam bingkai Mushaf Utsmani, sedangkan Tujuh Huruf ada sejak masa Nabi ﷺ',
      'Sama persis, sebab tujuh imam qira’at masing-masing menerima satu huruf langsung dari Nabi ﷺ',
      'Sama, karena Qira’at Sab‘ah merupakan terjemahan Al-Qur’an dalam tujuh bahasa asing',
      'Tidak; Tujuh Huruf baru dirumuskan setelah pemberian titik dan syakal huruf',
    ],
    correctAnswer:
      'Tidak; Qira’at Sab‘ah diseleksi pada abad ke-3 H dalam bingkai Mushaf Utsmani, sedangkan Tujuh Huruf ada sejak masa Nabi ﷺ',
    explanation:
      'Para ulama meluruskan bahwa Tujuh Huruf berbeda dengan Qira’at Sab‘ah. Khalifah Utsman telah menyeragamkan mushaf pada satu huruf (dialek Quraisy) pada abad ke-1 H, sedangkan Qira’at Sab‘ah baru diseleksi oleh Ibnu Mujahid pada abad ke-3 H dalam bingkai Mushaf Utsmani tersebut.',
    reference:
      'Manna Al-Qaththan, Pengantar Studi Ilmu Al-Qur’an, Bab 9; H. Sardana, Pondasi Dasar Memahami ‘Ulûmul Qur’ân, Bab V (hlm. 49–50)',
    difficulty: 'SEDANG',
    points: 10,
    timeLimitSec: 45,
    enabledModes: ['CERDAS_CERMAT', 'PAPAN_TANTANGAN'],
    isActive: true,
    isDemo: false,
  },
];

export interface PublicUlumulQuranQuestion {
  questionId: string;
  number: number;
  topicId?: string;
  topicName: string;
  subtopic?: string;
  questionText: string;
  options: string[];
}

export function getPublicUlumulQuranQuestions(): PublicUlumulQuranQuestion[] {
  return ULUMUL_QURAN_QUESTIONS.map((q, index) => ({
    questionId: q.questionId,
    number: index + 1,
    topicId: q.topicId,
    topicName: q.topicName,
    subtopic: q.subtopic,
    questionText: q.questionText,
    options: q.options ?? [],
  }));
}
