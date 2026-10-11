export type Level = "friendly" | "couple" | "extreme"
export type ProofKind = "voice" | "photo"
export type Avatar = "boy" | "girl"
export type Tone = "pink" | "gold" | "green" | "purple"

export const LEVELS: Record<Level, { label: string; tone: Tone; points: number; blurb: string }> = {
  friendly: { label: "Friendly", tone: "green", points: 2, blurb: "Cute, halki-phulki masti" },
  couple: { label: "Couple", tone: "pink", points: 3, blurb: "Romantic voice notes aur pyaari photos" },
  extreme: { label: "Extreme", tone: "purple", points: 4, blurb: "18+ dirty talk aur bold photos — sirf dono ki marzi se" },
}

export const LEVEL_ORDER: Level[] = ["friendly", "couple", "extreme"]

/** Recording a voice note takes longer than snapping a photo. */
export const SECONDS: Record<ProofKind, number> = { voice: 90, photo: 75 }

// [level, proof, short title for the live feed, full dare]. The partner "gives" each dare, so "mere/mujhe" = partner.
// Gendered verbs: {he|she} agrees with the player doing the dare, [he|she] with the partner hearing it.
export const DARES: [Level, ProofKind, string, string][] = [
  ["friendly", "voice", "3 acchi baatein", "Mere bare mein 3 acchi baatein bolo"],
  ["friendly", "voice", "Ek secret baat", "Tumhare bare mein ek aisi baat batao jo mujhe nahi pata"],
  ["friendly", "voice", "15 sec compliment", "Mujhe 15 second ka continuous compliment do"],
  ["friendly", "voice", "Cute nickname", "Mere liye ek cute nickname suggest karo aur usse mujhe bulao"],
  ["friendly", "voice", "Embarrassing yaad", "Mere bare mein ek embarrassing baat yaad karke batao"],
  ["friendly", "photo", "Funny face", "Apna ek funny face bana ke photo bhejo"],
  ["friendly", "photo", "Haath se likha naam", "Tumhare haath se likha hua mera naam photo kheench ke bhejo"],
  ["friendly", "voice", "Aaj ka mood", "Mujhe apna aaj ka mood ek emoji aur voice mein batao"],
  ["friendly", "voice", "Funny assumption", "Mere bare mein ek funny assumption batao"],
  ["friendly", "photo", "Haath ka heart", "Apne haath ka heart shape bana ke photo bhejo"],

  ["couple", "voice", "Sweet message", "Mere liye ek sweet romantic message bolo"],
  ["couple", "voice", "Kyun pyar?", "30 second mein batao ki tum mujhse kyun pyar {karte|karti} ho"],
  ["couple", "voice", "Favourite feature", "Mere favourite feature ke bare mein detail mein compliment do"],
  ["couple", "voice", "Ankahi baat", "Tumhare bare mein ek aisi baat batao jo maine pehle kabhi nahi kahi"],
  ["couple", "voice", "Shayari", "Mere liye ek romantic shayari ya line bolo"],
  ["couple", "photo", "Kiss mark", "Apne lips pe kiss mark bana ke photo bhejo"],
  ["couple", "photo", "Naam + heart", "Mere naam ke saath heart bana ke photo click karke bhejo"],
  ["couple", "voice", "3x I love you", "Mujhe “I love you” 3 alag romantic tarike se bolo"],
  ["couple", "voice", "Dil ki baat", "Mere bare mein ek pure emotional baat kaho"],
  ["couple", "photo", "Haath pe naam", "Apne haath pe mera naam likh ke photo bhejo"],

  ["extreme", "voice", "Dirty compliment", "Mere bare mein ek bold aur dirty compliment do"],
  ["extreme", "voice", "Horny confession", "“Tum mujhe bahut horny feel [karate|karati] ho” — clearly bolo"],
  ["extreme", "voice", "Fantasy", "Mere liye ek thoda vulgar fantasy short mein batao"],
  ["extreme", "voice", "Aaj raat…", "“Aaj raat tumhe…” se shuru karke dirty line complete karo"],
  ["extreme", "voice", "Body ki baat", "Mere body ke kisi feature ke bare mein openly dirty baat karo"],
  ["extreme", "voice", "Seduce line", "Mujhe seduce karne wali ek line bolo jo pehle kabhi nahi boli"],
  ["extreme", "voice", "Touch kaise", "Apne bare mein batao ki tum mujhe kaise touch karna {chahte|chahti} ho"],
  ["extreme", "voice", "Dirty talk", "Ek short dirty talk karo — 20-25 second ka"],
  ["extreme", "voice", "Main tumhe abhi…", "“Main tumhe abhi…” se shuru karke vulgar line bolo"],
  ["extreme", "photo", "Bold photo", "Apne collarbone / neck / lips ka thoda bold photo bhejo (comfortable ho to)"],
]

const pick = (a: Avatar | undefined) => (_: string, he: string, she: string) => (a === "girl" ? she : he)

/** Resolves the dare for whoever is doing it (`you`) and whoever hears it (`them`). */
export const dareInfo = (i: number, you?: Avatar, them?: Avatar) => {
  const [level, proof, title, raw] = DARES[i]
  const text = raw.replace(/\{(\w+)\|(\w+)\}/g, pick(you)).replace(/\[(\w+)\|(\w+)\]/g, pick(them))
  return { level, proof, title, text, seconds: SECONDS[proof], ...LEVELS[level] }
}
