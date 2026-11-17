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
      'Pengertian, syarat masa turunnya wahyu, pedoman riwayat shahih, kaidah Al-‘Ibrah bi ‘Umumil Lafzhi, serta redaksi shighat dan berbilangnya riwayat.',
    subtopics: ['Definisi & Batasan Zaman', 'Pedoman Riwayat', 'Kaidah Umum Lafaz', 'Redaksi Shighat'],
    orderIndex: 1,
  },
  {
    topicId: 'topic_uq_nuzul',
    name: 'Turunnya Al-Qur’an',
    description:
      'Makna Nuzulul Qur’an, dua tahap turunnya Al-Qur’an, perbedaan Inzal dan Tanzil, serta hikmah turun secara berangsur-angsur.',
    subtopics: ['Tahap Lauhul Mahfuzh & Baitul ‘Izzah', 'Inzal vs Tanzil', 'Hikmah Turun Bertahap', 'Pentahapan Hukum'],
    orderIndex: 2,
  },
  {
    topicId: 'topic_uq_jam',
    name: 'Pengumpulan & Penyusunan Al-Qur’an',
    description:
      'Kodifikasi Al-Qur’an pada masa Nabi SAW, Abu Bakar Ash-Shiddiq, dan Utsman bin Affan, serta sifat penertiban ayat dan surat.',
    subtopics: ['Masa Abu Bakar & Yamamah', 'Metode Zaid bin Tsabit', 'Mushaf Utsmani', 'Tertib Ayat Tauqifi'],
    orderIndex: 3,
  },
  {
    topicId: 'topic_uq_ahruf',
    name: 'Tujuh Huruf (Sab‘atu Ahruf)',
    description:
      'Dalil mutawatir turunnya Al-Qur’an dalam tujuh huruf, makna pendapat terkuat, hikmah keringanan, dan perbedaannya dengan Qira’at Sab‘ah.',
    subtopics: ['Hadis Sab‘atu Ahruf', 'Makna Tujuh Bahasa/Dialek', 'Hikmah Keringanan', 'Tujuh Huruf vs Qira’at Sab‘ah'],
    orderIndex: 4,
  },
];

export const ULUMUL_QURAN_QUESTIONS: Array<Omit<QuestionPrivate, 'createdAt' | 'updatedAt'>> = [
  {
    questionId: 'uq_q_01',
    topicId: 'topic_uq_asbab',
    topicName: 'Asbabun Nuzul',
    subtopic: 'Definisi & Batasan Zaman',
    type: 'MULTIPLE_CHOICE',
    questionText:
      'Berdasarkan definisi Asbabun Nuzul dalam kajian ‘Ulûmul Qur’ân, peristiwa manakah yang TIDAK termasuk Asbabun Nuzul karena tidak memenuhi syarat batasan waktu turunnya wahyu?',
    options: [
      'Kisah umat terdahulu sebelum masa kenabian Muhammad ﷺ, seperti kisah pasukan bergajah (Ashabul Fil) pada QS. Al-Fil',
      'Pertanyaan para sahabat kepada Rasulullah ﷺ tentang syariat atau ruh pada masa turunnya wahyu',
      'Peristiwa perselisihan keluarga atau hukum yang terjadi pada masa kehidupan Nabi Muhammad ﷺ',
      'Pertanyaan kaum Yahudi atau musyrikin yang diajukan langsung kepada Nabi Muhammad ﷺ ketika Al-Qur’an masih turun',
    ],
    correctAnswer:
      'Kisah umat terdahulu sebelum masa kenabian Muhammad ﷺ, seperti kisah pasukan bergajah (Ashabul Fil) pada QS. Al-Fil',
    explanation:
      'Asbabun Nuzul mensyaratkan peristiwa atau pertanyaan yang terjadi pada masa turunnya Al-Qur’an (zaman kenabian Muhammad ﷺ). Imam As-Suyuthi mengkritik Al-Wahidi karena memasukkan kisah Ashabul Fil sebagai sebab turunnya QS. Al-Fil, padahal kejadian itu berlangsung sebelum masa turunnya wahyu dan merupakan bagian dari kisah umat terdahulu.',
    reference:
      'Manna Al-Qaththan, Pengantar Studi Ilmu Al-Qur’an, Bab 6 (Asbabun Nuzul); H. Sardana, Pondasi Dasar Memahami ‘Ulûmul Qur’ân, Bab VI',
    difficulty: 'SEDANG',
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
      'Bagaimanakah pedoman yang disepakati para ulama untuk mengetahui secara sahih Asbabun Nuzul suatu ayat Al-Qur’an?',
    options: [
      'Hanya melalui riwayat yang shahih dari Nabi ﷺ atau sahabat yang menyaksikan langsung sebab dan turunnya ayat',
      'Melalui analisis kebahasaan dan penalaran akal (ra’yu) mufasir terhadap konteks sosial kontemporer',
      'Berdasarkan perkiraan logis mufasir muta’akhkhirin tanpa perlu memperhatikan sanad riwayat',
      'Dengan membandingkan kisah-kisah umat terdahulu sebelum diutusnya Nabi Muhammad ﷺ',
    ],
    correctAnswer:
      'Hanya melalui riwayat yang shahih dari Nabi ﷺ atau sahabat yang menyaksikan langsung sebab dan turunnya ayat',
    explanation:
      'Para ulama seperti Al-Wahidi menegaskan bahwa mengetahui Asbabun Nuzul tidak boleh ditempuh dengan akal-akalan (ra’yu/ijtihad semata), melainkan hanya berlandaskan riwayat shahih dari sahabat yang menyaksikan langsung peristiwa turunnya ayat.',
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
      'Apabila suatu ayat turun karena sebab yang khusus sedangkan redaksi lafaz ayat tersebut bersifat umum—seperti ayat Li’an (QS. An-Nur: 6–9) atau Zhihar (QS. Al-Mujadilah: 1)—kaidah manakah yang dipegang oleh jumhur ulama?',
    options: [
      'Al-‘ibratu bi ‘umumil lafzhi la bi khushushis sabab (yang menjadi pegangan adalah keumuman lafaz, bukan kekhususan sebab)',
      'Al-‘ibratu bi khushushis sabab la bi ‘umumil lafzhi (hukum ayat hanya berlaku khusus bagi pelaku peristiwanya saja)',
      'Hukum ayat otomatis berhenti berlaku setelah sahabat yang menjadi sebab turunnya wafat',
      'Bentuk sebab asal harus dikeluarkan terlebih dahulu dari cakupan lafaz umum melalui takhshish',
    ],
    correctAnswer:
      'Al-‘ibratu bi ‘umumil lafzhi la bi khushushis sabab (yang menjadi pegangan adalah keumuman lafaz, bukan kekhususan sebab)',
    explanation:
      'Jumhur ulama menetapkan kaidah Al-‘ibratu bi ‘umumil lafzhi la bi khushushis sabab, yakni hukum ditetapkan menurut keumuman redaksi ayat, bukan semata kekhususan peristiwa awalnya. Karena itu hukum Li’an (terkait Hilal bin Umayyah) dan Zhihar (terkait Khaulah binti Tsa’labah & Aus bin Ash-Shamit) berlaku umum untuk seluruh umat.',
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
    subtopic: 'Redaksi Shighat',
    type: 'MULTIPLE_CHOICE',
    questionText:
      'Jika terdapat dua riwayat shahih tentang suatu ayat: riwayat pertama memakai redaksi tegas (sharih, seperti "Maka turunlah ayat...") dan riwayat kedua memakai redaksi muhtamilah ("Ayat ini turun mengenai..."), bagaimana cara ulama menyikapinya?',
    options: [
      'Mengambil riwayat yang berredaksi tegas (sharih) sebagai Asbabun Nuzul, sedangkan redaksi muhtamilah dipahami sebagai penjelasan kandungan makna ayat',
      'Menolak kedua riwayat tersebut karena dianggap saling bertentangan satu sama lain',
      'Langsung menyimpulkan bahwa ayat tersebut diturunkan berulang kali tanpa proses tarjih',
      'Mengutamakan riwayat muhtamilah karena bentuk ungkapannya bersifat penafsiran umum',
    ],
    correctAnswer:
      'Mengambil riwayat yang berredaksi tegas (sharih) sebagai Asbabun Nuzul, sedangkan redaksi muhtamilah dipahami sebagai penjelasan kandungan makna ayat',
    explanation:
      'Redaksi "Nazalat hadzihil ayatu fi kadza" tergolong muhtamilah (mengandung dua kemungkinan: sebab turunnya ayat atau sekadar penjelasan kandungan hukum ayat). Apabila bertemu dengan riwayat shahih yang tegas (sharih), maka riwayat yang tegas itulah yang ditetapkan sebagai Asbabun Nuzul.',
    reference:
      'Manna Al-Qaththan, Pengantar Studi Ilmu Al-Qur’an, Bab 6 (Redaksi dan Berbilangnya Riwayat Asbabun Nuzul); H. Sardana, Bab VI',
    difficulty: 'SULIT',
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
    subtopic: 'Tahap Lauhul Mahfuzh & Baitul ‘Izzah',
    type: 'MULTIPLE_CHOICE',
    questionText:
      'Menurut mazhab jumhur ulama yang berpegang pada riwayat shahih Ibnu Abbas رضي الله عنهما, bagaimanakah tahapan turunnya Al-Qur’an berlangsung?',
    options: [
      'Turun sekaligus (jumlatan wahidah) ke Baitul ‘Izzah di langit dunia pada malam Lailatul Qadar, lalu turun berangsur-angsur (munajjaman) kepada Nabi ﷺ selama ±23 tahun',
      'Turun sekaligus seluruh 30 juz langsung ke hati Nabi Muhammad ﷺ pada tanggal 17 Ramadhan tahun ke-2 Hijriah',
      'Turun bertahap dari Allah ke Lauhul Mahfuzh pada setiap malam Lailatul Qadar selama 23 tahun tanpa singgah di Baitul ‘Izzah',
      'Turun sekaligus berbentuk lembaran mushaf tertulis lengkap sebagaimana kitab Taurat Nabi Musa عليه السلام',
    ],
    correctAnswer:
      'Turun sekaligus (jumlatan wahidah) ke Baitul ‘Izzah di langit dunia pada malam Lailatul Qadar, lalu turun berangsur-angsur (munajjaman) kepada Nabi ﷺ selama ±23 tahun',
    explanation:
      'Pendapat yang paling kuat menurut jumhur ulama memadukan ayat tentang turunnya Al-Qur’an di bulan Ramadhan/Lailatul Qadar dengan kenyataan turunnya bertahap: tahap pertama turun sekaligus dari Lauhul Mahfuzh ke Baitul ‘Izzah (langit dunia) pada Lailatul Qadar, dan tahap kedua turun berangsur-angsur kepada Rasulullah ﷺ melalui Jibril selama 23 tahun (13 tahun di Makkah dan 10 tahun di Madinah).',
    reference:
      'Manna Al-Qaththan, Pengantar Studi Ilmu Al-Qur’an, Bab 7 (Turunnya Al-Qur’an); H. Sardana, Pondasi Dasar Memahami ‘Ulûmul Qur’ân, Bab IV',
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
      'Mengutip penjelasan Ar-Raghib Al-Ashfahani dalam pembahasan Nuzulul Qur’an, apakah perbedaan nuansa makna antara kata Tanzil (تَنْزِيلٌ) dan Inzal (إِنْزَالٌ)?',
    options: [
      'Tanzil mengandung makna turun secara berangsur-angsur (bertahap), sedangkan Inzal menunjukkan makna turun secara umum (termasuk sekaligus)',
      'Inzal hanya digunakan untuk ayat-ayat Madaniyah, sedangkan Tanzil khusus bagi ayat-ayat Makkiyah',
      'Tanzil berarti wahyu melalui mimpi yang benar, sedangkan Inzal berarti wahyu melalui Malaikat Jibril',
      'Keduanya sama-sama bermakna penurunan kitab suci yang rampung sekaligus dalam satu malam',
    ],
    correctAnswer:
      'Tanzil mengandung makna turun secara berangsur-angsur (bertahap), sedangkan Inzal menunjukkan makna turun secara umum (termasuk sekaligus)',
    explanation:
      'Ar-Raghib membedakan kedua lafaz tersebut: kata Tanzil menunjukkan proses turun secara bertahap dan berangsur-angsur sedikit demi sedikit, sedangkan kata Inzal memiliki makna turun secara umum baik sekaligus maupun bertahap.',
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
      'Dalam QS. Al-Furqan ayat 32, Allah menjawab pertanyaan kaum kafir mengapa Al-Qur’an tidak diturunkan sekaligus dengan firman-Nya "kadzalika linutsabbita bihi fu’adaka". Hikmah utama yang ditegaskan penggalan ayat ini adalah...',
    options: [
      'Untuk meneguhkan dan memantapkan hati Rasulullah ﷺ dalam menghadapi tentangan dakwah',
      'Untuk mempercepat penulisan mushaf lengkap sebelum periode hijrah ke Madinah',
      'Untuk menyamakan cara turunnya Al-Qur’an dengan kitab Taurat dan Zabur',
      'Untuk mengurangi ketergantungan para sahabat terhadap hafalan ayat-ayat panjang',
    ],
    correctAnswer:
      'Untuk meneguhkan dan memantapkan hati Rasulullah ﷺ dalam menghadapi tentangan dakwah',
    explanation:
      'Hikmah pertama yang disebutkan langsung dalam QS. Al-Furqan: 32 adalah meneguhkan hati Rasulullah ﷺ (tatsbitu fu’adin Nabi) setiap kali menghadapi tekanan kaum musyrikin, di samping hikmah menjawab tantangan musyrik, memudahkan hafalan umat yang ummi, serta pentahapan hukum.',
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
      'Contoh paling jelas dari hikmah turunnya Al-Qur’an secara bertahap dalam menerapkan pentahapan hukum (tadarruj fit tasyri’) adalah syariat mengenai...',
    options: [
      'Pengharaman minuman keras (khamr) yang diturunkan secara bertahap melalui empat rangkaian ayat hingga diharamkan secara mutlak',
      'Kewajiban shalat lima waktu yang diturunkan dalam empat tahap terpisah di Madinah',
      'Larangan transaksi riba yang langsung diharamkan secara penuh pada wahyu pertama di Gua Hira',
      'Perintah pemindahan arah kiblat dari Baitul Maqdis ke Ka’bah melalui empat surat Makkiyah',
    ],
    correctAnswer:
      'Pengharaman minuman keras (khamr) yang diturunkan secara bertahap melalui empat rangkaian ayat hingga diharamkan secara mutlak',
    explanation:
      'Kebiasaan minum khamr yang mengakar di masyarakat Arab tidak dihapus secara mendadak, melainkan melalui empat tahap ayat: QS. An-Nahl: 67 (isyarat perbedaan rezeki baik dan memabukkan), QS. Al-Baqarah: 219 (dosanya lebih besar daripada manfaatnya), QS. An-Nisa’: 43 (larangan shalat dalam keadaan mabuk), hingga QS. Al-Ma’idah: 90–91 (pengharaman tegas).',
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
      'Peristiwa genting apakah yang melatarbelakangi Umar bin Al-Khaththab mengusulkan pengumpulan Al-Qur’an kepada Khalifah Abu Bakar Ash-Shiddiq?',
    options: [
      'Gugurnya sekitar 70 sahabat penghafal Al-Qur’an (qurra’) dalam Perang Yamamah melawan Musailamah Al-Kadzdzab',
      'Pertikaian bacaan antara pasukan Syam dan Irak saat ekspedisi ke Armenia dan Azerbaijan',
      'Rusaknya seluruh catatan wahyu pada pelepah kurma yang disimpan di rumah Hafshah binti Umar',
      'Banyaknya masyarakat non-Arab yang belum dapat membaca tulisan Arab gundul',
    ],
    correctAnswer:
      'Gugurnya sekitar 70 sahabat penghafal Al-Qur’an (qurra’) dalam Perang Yamamah melawan Musailamah Al-Kadzdzab',
    explanation:
      'Pada Perang Yamamah tahun 12 H melawan Musailamah Al-Kadzdzab, gugur sekitar 70 sahabat penghafal Al-Qur’an. Khawatir Al-Qur’an akan banyak hilang seiring wafatnya para qurra’, Umar mengusulkan kepada Abu Bakar agar seluruh ayat Al-Qur’an dihimpun dalam satu mushaf, yang kemudian diamanahkan kepada Zaid bin Tsabit.',
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
    subtopic: 'Metode Zaid bin Tsabit',
    type: 'MULTIPLE_CHOICE',
    questionText:
      'Dalam proyek pengumpulan Al-Qur’an pada masa Abu Bakar, Zaid bin Tsabit menerapkan kehati-hatian sangat tinggi: ia tidak hanya menerima hafalan semata, melainkan mensyaratkan bukti hafalan dan catatan tertulis yang dikuatkan oleh...',
    options: [
      'Dua orang saksi bahwa tulisan ayat tersebut benar-benar ditulis di hadapan Rasulullah ﷺ',
      'Persetujuan sepuluh orang pemimpin kabilah dari wilayah Hijaz dan Yaman',
      'Satu orang saksi dari generasi tabi’in yang berdomisili di kota Madinah',
      'Catatan pribadi penulis tanpa perlu verifikasi kesaksian sahabat lain',
    ],
    correctAnswer:
      'Dua orang saksi bahwa tulisan ayat tersebut benar-benar ditulis di hadapan Rasulullah ﷺ',
    explanation:
      'Zaid bin Tsabit tidak mencukupkan diri dengan hafalannya sendiri atau catatan tanpa saksi; setiap ayat harus memenuhi hafalan sahabat serta catatan tertulis yang disaksikan oleh dua orang saksi bahwa naskah itu ditulis di hadapan Nabi ﷺ (kecuali dua ayat terakhir QS. At-Taubah yang catatannya hanya ditemukan pada Abu Khuzaimah Al-Anshari yang kesaksiannya disamakan dengan dua saksi).',
    reference:
      'Manna Al-Qaththan, Pengantar Studi Ilmu Al-Qur’an, Bab 8; H. Sardana, Pondasi Dasar Memahami ‘Ulûmul Qur’ân, Bab V',
    difficulty: 'SEDANG',
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
      'Menyikapi laporan Hudzaifah bin Al-Yaman tentang perselisihan bacaan di Armenia dan Azerbaijan, Khalifah Utsman bin Affan membentuk tim penyalin (Zaid bin Tsabit dan tiga tokoh Quraisy). Pedoman apa yang diperintahkan Utsman apabila terjadi perbedaan bahasa penulisan di antara mereka?',
    options: [
      'Menuliskannya menurut dialek bahasa Quraisy (lisan Quraisy) karena Al-Qur’an diturunkan dalam bahasa mereka',
      'Menuliskannya menurut dialek suku Hudzail atau Tamim sesuai kesepakatan pasukan Syam',
      'Mencantumkan seluruh variasi dialek tujuh kabilah Arab berdampingan pada satu baris mushaf',
      'Menyerahkan pilihan ejaan kata kepada gubernur Kufah dan Bashrah masing-masing',
    ],
    correctAnswer:
      'Menuliskannya menurut dialek bahasa Quraisy (lisan Quraisy) karena Al-Qur’an diturunkan dalam bahasa mereka',
    explanation:
      'Utsman berpesan kepada tiga anggota tim dari suku Quraisy (Abdullah bin Az-Zubair, Sa’id bin Al-Ash, dan Abdurrahman bin Al-Harits bin Hisyam): jika mereka berselisih dengan Zaid bin Tsabit mengenai penulisan kata dalam Al-Qur’an, tulislah dengan bahasa Quraisy (seperti penulisan kata at-tabut dengan huruf ta’). Tujuannya menyeragamkan mushaf induk (Mushaf al-Imam) untuk meredam perpecahan umat.',
    reference:
      'Manna Al-Qaththan, Pengantar Studi Ilmu Al-Qur’an, Bab 8 (Pengumpulan Al-Qur’an Masa Utsman); H. Sardana, Bab V',
    difficulty: 'SEDANG',
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
    subtopic: 'Tertib Ayat Tauqifi',
    type: 'MULTIPLE_CHOICE',
    questionText:
      'Berdasarkan ijma’ para ulama dalam pembahasan pengumpulan dan penertiban Al-Qur’an, bagaimanakah status susunan (tartib) ayat-ayat di dalam setiap surat Al-Qur’an?',
    options: [
      'Bersifat Tauqifi, yaitu ketentuan langsung dari Rasulullah ﷺ atas petunjuk Malaikat Jibril dan bukan ijtihad sahabat',
      'Bersifat Ijtihadi murni hasil penyusunan panitia Utsman bin Affan berdasarkan panjang pendeknya ayat',
      'Mengikuti urutan kronologis turunnya ayat dari awal kenabian hingga wafatnya Nabi ﷺ',
      'Disusun ulang menurut urutan abjad huruf pertama pada setiap ayat oleh Abul Aswad Ad-Duali',
    ],
    correctAnswer:
      'Bersifat Tauqifi, yaitu ketentuan langsung dari Rasulullah ﷺ atas petunjuk Malaikat Jibril dan bukan ijtihad sahabat',
    explanation:
      'Ulama bersepakat (ijma’) bahwa penertiban ayat-ayat di dalam surat adalah tauqifi — ditetapkan langsung oleh Rasulullah ﷺ berdasarkan bimbingan Malaikat Jibril. Nabi ﷺ selalu memerintahkan penulis wahyu untuk meletakkan ayat tertentu pada surat dan posisi yang telah ditentukan.',
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
    subtopic: 'Hikmah Keringanan',
    type: 'MULTIPLE_CHOICE',
    questionText:
      'Dalam hadis Ubay bin Ka’ab رضي الله عنه ketika Rasulullah ﷺ memohon kepada Allah melalui Jibril agar Al-Qur’an diringankan bacaannya dari satu huruf hingga tujuh huruf, apakah alasan utama permohonan Nabi ﷺ tersebut?',
    options: [
      'Karena umat beliau terdiri atas masyarakat ummi, termasuk kakek-kakek, nenek-nenek, anak-anak, dan hamba sahaya yang sulit membaca satu huruf/dialek saja',
      'Karena Al-Qur’an harus diterjemahkan ke dalam tujuh bahasa kerajaan asing di luar Jazirah Arab',
      'Agar setiap suku diizinkan mengganti kandungan hukum ayat sesuai tradisi adatnya',
      'Karena jumlah surat terpanjang (ath-thiwal) dalam mushaf berjumlah tujuh surat',
    ],
    correctAnswer:
      'Karena umat beliau terdiri atas masyarakat ummi, termasuk kakek-kakek, nenek-nenek, anak-anak, dan hamba sahaya yang sulit membaca satu huruf/dialek saja',
    explanation:
      'Pada hadis riwayat Ubay bin Ka’ab di Ahjar Mira’, Nabi ﷺ menjelaskan kepada Jibril bahwa umatnya adalah bangsa yang ummi; di antara mereka terdapat orang tua renta, nenek-nenek, anak-anak, dan hamba sahaya yang tidak pernah membaca kitab sebelumnya. Atas permohonan keringanan itu, Jibril menambah izin bacaan bertahap hingga tujuh huruf demi memudahkan bacaan dan hafalan mereka.',
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
    subtopic: 'Makna Tujuh Bahasa/Dialek',
    type: 'MULTIPLE_CHOICE',
    questionText:
      'Di antara beragam pendapat ulama mengenai pengertian "Tujuh Huruf" (Sab‘atu Ahruf), pendapat manakah yang dinilai paling kuat dan dipilih oleh mayoritas ulama seperti Ath-Thabari, Ibnu Abdil Barr, dan Manna Al-Qaththan?',
    options: [
      'Tujuh macam bahasa atau dialek Arab mengenai satu makna yang sama (lafaz berbeda namun maknanya sinonim)',
      'Tujuh tingkatan makna batin dan tafsir isyari yang hanya dipahami oleh kalangan tertentu',
      'Tujuh jenis tanda baca harakat dan titik huruf yang disusun pada masa Daulah Umayyah',
      'Angka tujuh semata-mata simbol kesempurnaan, bukan jumlah tujuh yang sebenarnya',
    ],
    correctAnswer:
      'Tujuh macam bahasa atau dialek Arab mengenai satu makna yang sama (lafaz berbeda namun maknanya sinonim)',
    explanation:
      'Pendapat terkuat menegaskan bahwa Sab‘atu Ahruf adalah tujuh ragam ungkapan/bahasa dari bahasa-bahasa Arab yang menunjuk satu makna yang sama (seperti lafaz halumma, ta’al, aqbil yang semuanya bermakna "kemarilah"), selama ayat rahmat tidak diakhiri azab atau sebaliknya. Pendapat yang memaknai tujuh sekadar simbol terbantahkan oleh hadis peningkatan bertahap dari 1, 2, 3, hingga 7 huruf.',
    reference:
      'Manna Al-Qaththan, Pengantar Studi Ilmu Al-Qur’an, Bab 9 (Perbedaan Pendapat Tentang Pengertian Tujuh Huruf)',
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
      'Sebagian kalangan kerap menyamakan "Tujuh Huruf" (Sab‘atu Ahruf) dengan Qira’at Sab‘ah (Tujuh Imam Qira’at). Bagaimanakah pelurusan para ulama seperti Abu Syamah dan Manna Al-Qaththan atas anggapan tersebut?',
    options: [
      'Anggapan itu keliru; Qira’at Sab‘ah baru dipilih pada abad ke-3 H oleh Abu Bakar bin Mujahid dari satu huruf (Mushaf Utsmani), sedangkan tujuh huruf ada sebelum penyeragaman Utsman',
      'Anggapan itu tepat karena ketujuh imam qira’at menerima langsung masing-masing satu huruf dari Rasulullah ﷺ',
      'Qira’at Sab‘ah mencakup tujuh bahasa asing non-Arab yang disusun ulang pada masa Abu Bakar Ash-Shiddiq',
      'Tujuh huruf baru lahir bersamaan dengan pemberian tanda titik huruf oleh Al-Khalil bin Ahmad Al-Farahidi',
    ],
    correctAnswer:
      'Anggapan itu keliru; Qira’at Sab‘ah baru dipilih pada abad ke-3 H oleh Abu Bakar bin Mujahid dari satu huruf (Mushaf Utsmani), sedangkan tujuh huruf ada sebelum penyeragaman Utsman',
    explanation:
      'Para ulama membantah tegas penyamaan Tujuh Huruf dengan Qira’at Sab‘ah. Khalifah Utsman bin Affan telah menyatukan umat pada satu huruf (dialek Quraisy) pada abad ke-1 H. Sementara itu, tujuh imam qira’at (Qira’at Sab‘ah) baru diseleksi dan dipopulerkan oleh Ibnu Mujahid pada abad ke-3 H dan seluruh bacaan mereka berada dalam bingkai satu huruf Mushaf Utsmani tersebut.',
    reference:
      'Manna Al-Qaththan, Pengantar Studi Ilmu Al-Qur’an, Bab 9; H. Sardana, Pondasi Dasar Memahami ‘Ulûmul Qur’ân, Bab V (hlm. 49–50)',
    difficulty: 'SULIT',
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
