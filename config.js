window.SITE = {
  clinic: "Heal 360 Online Clinic",
  short: "Heal 360",
  phone: "+917511136045",
  phoneShow: "+91 75111 36045",
  whatsapp: "917511136045",
  domain: "",            // fill when the domain is bought
  /* ---- used by the booking calendar and doctor pages ---- */
  brand: { title: "HEAL 360", subtitle: "Online Clinic" },
  theme: { brand: "#1a73e8", brandDeep: "#0b2e6f", accent: "#188038", light: "#bcd7ff" },
  doctor: { name: "Heal 360 Online Clinic", shortName: "Heal 360", photo: "logo-real/mark-256.png", role: "Online homoeopathy clinic" },
  contact: { phoneDisplay: "+91 75111 36045", whatsapp: "917511136045", clinicName: "Heal 360 Online Clinic" },
  payment: { upiId: "", payeeName: "Heal 360 Online Clinic" },
  cal: { username: "", doctorEmail: "" },
  video: { roomUrl: "" },
  consultations: {
    intro: "Choose your consultation, then pick your time.",
    types: [
      { calSlug: "online-video-consultation", name: "New consultation", duration: "30 minutes", fee: 0, featured: true, text: "A detailed first consultation with a complete case history." },
      { calSlug: "review-consultation", name: "Review consultation", duration: "20 minutes", fee: 0, text: "For patients already under the doctor's care." }
    ]
  },
  helper: { url: "" },   // DotCom booking helper URL (set after the helper is deployed)
  doctors: [
    {
      id: "seena",
      title: "BHMS, MD (Paediatrics) · TCMC Reg. 10868",
      languages: "Malayalam, English",
      name: "Dr. Seena Naseem K.A.",
      quals: "BHMS, MD (Paediatrics)",
      role: "Paediatric Care & Allergic Disorders",
      tag: "Children & Allergy",
      photo: "img/seena.jpg",
      reg: "10868",
      years: "10+ years",
      hook: "Does your child fall sick again and again? Frequent cold, cough, sneezing or allergies that just don't settle?",
      bio: [
        "Dr. Seena Naseem K.A. is a passionate and dedicated homoeopathic physician with over 10 years of clinical experience, committed to compassionate, personalised and holistic healthcare, particularly for children.",
        "She graduated from Government Homoeopathic Medical College, Calicut, and completed her postgraduate specialisation in Paediatrics at Vinayaka Missions Homoeopathic Medical College, Salem.",
        "With a special interest in paediatric health and allergic conditions, she focuses on the individualised assessment of children with recurrent health concerns, allergic disorders and chronic respiratory complaints. Her approach looks at the child's overall health, symptom patterns, contributing factors and individual needs, to support their well-being and quality of life."
      ],
      areas: ["Adenoiditis / Adenoid Hypertrophy", "Allergic Rhinitis", "Recurrent Respiratory Infections", "Childhood & Skin Allergies", "Various other Paediatric Conditions"],
      vision: "Her vision is to make quality, compassionate and personalised paediatric care accessible to families everywhere through online consultations at Heal 360 Online Clinic."
    },
    {
      id: "shameema",
      title: "BHMS, MD (Homoeopathy) Scholar · TCMC Reg. 10829",
      languages: "Malayalam, English",
      name: "Dr. Shameema",
      quals: "BHMS, MD (Homoeopathy) Scholar",
      role: "Carpal Tunnel Syndrome & Nerve Pain",
      tag: "Nerves & Hands",
      photo: "img/shameema.jpg",
      reg: "10829",
      years: "10+ years",
      hook: "Do your hands go numb at night? Tingling or pain in your fingers, or dropping things because your grip feels weak?",
      bio: [
        "These are common signs of Carpal Tunnel Syndrome, where a nerve in the wrist gets pressed, causing pain and numbness in the hand.",
        "Dr. Shameema is a caring homoeopathic physician with over 10 years of experience, and treating this problem is her special interest. She completed her BHMS at Government Homoeopathic Medical College, Kozhikode, and is now pursuing her MD at the same college.",
        "In her years of practice she has helped many patients find relief from hand pain, numbness and tingling. Some had already been advised surgery, and in her experience many improved with homoeopathic medicines and were able to avoid it.",
        "She takes time to listen to your problem, understand your health history and daily routine, and plan treatment that suits you personally."
      ],
      areas: ["Carpal Tunnel Syndrome", "Hand pain, numbness & tingling", "Weak grip & dropping things", "Night-time numbness of the hands"],
      vision: "Her belief: healing is not just about relieving symptoms, but restoring the whole person."
    },
    {
      id: "musheera",
      title: "BHMS · TCMC Reg. 11350",
      languages: "Malayalam, English",
      name: "Dr. Musheera K.",
      quals: "BHMS",
      role: "Skin & Hair Health",
      tag: "Skin & Hair",
      photo: "img/musheera.jpg",
      reg: "11350",
      years: "7+ years",
      hook: "Stubborn skin trouble or hair fall that keeps coming back? A calm, careful look at the whole picture can help.",
      bio: [
        "Dr. Musheera K. is a dedicated homoeopathic physician with over 7 years of clinical experience and a Bachelor of Homoeopathic Medicine and Surgery (BHMS) from Government Homoeopathic Medical College, Kozhikode.",
        "She is the founder and practising physician at Dr. Musheera's Homoeo Care, Feroke Chungam, Kozhikode, and also serves as a Senior Consultant at a charitable clinic run under a mosque in Pulikkal, Malappuram, contributing to community healthcare.",
        "She believes in compassionate, individualised patient care, with an emphasis on understanding each patient's concerns and providing attentive consultations."
      ],
      areas: ["Warts & other skin growths", "Eczema, dermatitis & psoriasis", "Allergic skin conditions", "Acne & recurrent eruptions", "Alopecia & hair loss", "Dandruff & scalp disorders", "Skin pigmentation concerns", "Chronic & recurring skin complaints"],
      vision: "Compassionate Care · Personalised Attention · Patient-Centred Practice"
    }
  ]
};
