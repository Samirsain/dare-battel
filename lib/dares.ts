export type Level = "friendly" | "couple" | "extreme"
export type ProofKind = "voice" | "photo"
export type Avatar = "boy" | "girl"
export type Lang = "hi" | "en" // "hi" = Hinglish (Roman script), the default
export type Tone = "pink" | "gold" | "green" | "purple"

export const LEVELS: Record<Level, { label: string; tone: Tone; points: number; blurb: string; blurbEn: string }> = {
  friendly: { label: "Friendly", tone: "green", points: 2, blurb: "Cute, halki-phulki masti", blurbEn: "Cute, light-hearted fun" },
  couple: { label: "Couple", tone: "pink", points: 3, blurb: "Romantic voice notes aur pyaari photos", blurbEn: "Romantic voice notes and sweet photos" },
  extreme: {
    label: "Extreme",
    tone: "purple",
    points: 4,
    blurb: "18+ dirty talk aur bold photos — sirf dono ki marzi se",
    blurbEn: "18+ dirty talk and bold photos — only if you both want it",
  },
}

export const LEVEL_ORDER: Level[] = ["friendly", "couple", "extreme"]

/** Recording a voice note takes longer than snapping a photo. */
export const SECONDS: Record<ProofKind, number> = { voice: 90, photo: 75 }

// [level, proof, title, dare, English title, English dare]. The partner gives each dare, so "mere/mujhe/me" = the giver.
// Gendered Hindi verbs: {he|she} agrees with the player doing the dare, [he|she] with the partner hearing it.
export const DARES: [Level, ProofKind, string, string, string, string][] = [
  ["friendly", "voice", "3 acchi baatein", "Mere bare mein 3 acchi baatein bolo", "3 nice things", "Say 3 nice things about me"],
  ["friendly", "voice", "Ek secret baat", "Tumhare bare mein ek aisi baat batao jo mujhe nahi pata", "A secret", "Tell me something about yourself that I don't know"],
  ["friendly", "voice", "15 sec compliment", "Mujhe 15 second ka continuous compliment do", "15-sec compliment", "Compliment me non-stop for 15 seconds"],
  ["friendly", "voice", "Cute nickname", "Mere liye ek cute nickname suggest karo aur usse mujhe bulao", "Cute nickname", "Come up with a cute nickname for me and call me by it"],
  ["friendly", "voice", "Embarrassing yaad", "Mere bare mein ek embarrassing baat yaad karke batao", "Embarrassing memory", "Remember something embarrassing about me and tell it"],
  ["friendly", "photo", "Funny face", "Apna ek funny face bana ke photo bhejo", "Funny face", "Pull a funny face and send me a photo"],
  ["friendly", "photo", "Haath se likha naam", "Tumhare haath se likha hua mera naam photo kheench ke bhejo", "My name, handwritten", "Write my name by hand and send me a photo of it"],
  ["friendly", "voice", "Aaj ka mood", "Mujhe apna aaj ka mood ek emoji aur voice mein batao", "Today's mood", "Tell me your mood today with one emoji and your voice"],
  ["friendly", "voice", "Funny assumption", "Mere bare mein ek funny assumption batao", "Funny assumption", "Tell me one funny assumption about me"],
  ["friendly", "photo", "Haath ka heart", "Apne haath ka heart shape bana ke photo bhejo", "Hand heart", "Make a heart with your hands and send me a photo"],

  ["couple", "voice", "Sweet message", "Mere liye ek sweet romantic message bolo", "Sweet message", "Say a sweet romantic message for me"],
  ["couple", "voice", "Kyun pyar?", "30 second mein batao ki tum mujhse kyun pyar {karte|karti} ho", "Why love me?", "In 30 seconds, tell me why you love me"],
  ["couple", "voice", "Favourite feature", "Mere favourite feature ke bare mein detail mein compliment do", "Favourite feature", "Compliment your favourite feature of mine in detail"],
  ["couple", "voice", "Ankahi baat", "Tumhare bare mein ek aisi baat batao jo maine pehle kabhi nahi kahi", "Never said", "Tell me something about you that I've never said out loud"],
  ["couple", "voice", "Shayari", "Mere liye ek romantic shayari ya line bolo", "Shayari", "Say a romantic shayari or line for me"],
  ["couple", "photo", "Kiss mark", "Apne lips pe kiss mark bana ke photo bhejo", "Kiss mark", "Leave a kiss mark with your lips and send me a photo"],
  ["couple", "photo", "Naam + heart", "Mere naam ke saath heart bana ke photo click karke bhejo", "Name + heart", "Draw a heart around my name and send me a photo"],
  ["couple", "voice", "3x I love you", "Mujhe “I love you” 3 alag romantic tarike se bolo", "3x I love you", "Say “I love you” to me in 3 different romantic ways"],
  ["couple", "voice", "Dil ki baat", "Mere bare mein ek pure emotional baat kaho", "From the heart", "Say something deeply emotional about me"],
  ["couple", "photo", "Haath pe naam", "Apne haath pe mera naam likh ke photo bhejo", "My name on your hand", "Write my name on your hand and send me a photo"],

  ["extreme", "voice", "Dirty compliment", "Mere bare mein ek bold aur dirty compliment do", "Dirty compliment", "Give me a bold, dirty compliment"],
  ["extreme", "voice", "Horny confession", "“Tum mujhe bahut horny feel [karate|karati] ho” — clearly bolo", "Horny confession", "Say it clearly: “You make me feel so horny”"],
  ["extreme", "voice", "Fantasy", "Mere liye ek thoda vulgar fantasy short mein batao", "Fantasy", "Tell me one of your naughty fantasies, short and sweet"],
  ["extreme", "voice", "Aaj raat…", "“Aaj raat tumhe…” se shuru karke dirty line complete karo", "Tonight…", "Start with “Tonight I'm going to…” and finish the dirty line"],
  ["extreme", "voice", "Body ki baat", "Mere body ke kisi feature ke bare mein openly dirty baat karo", "Body talk", "Talk openly and dirty about one part of my body"],
  ["extreme", "voice", "Seduce line", "Mujhe seduce karne wali ek line bolo jo pehle kabhi nahi boli", "Seduce line", "Say a line to seduce me that you've never used before"],
  ["extreme", "voice", "Touch kaise", "Apne bare mein batao ki tum mujhe kaise touch karna {chahte|chahti} ho", "How you'd touch", "Tell me exactly how you want to touch me"],
  ["extreme", "voice", "Dirty talk", "Ek short dirty talk karo — 20-25 second ka", "Dirty talk", "Give me 20–25 seconds of dirty talk"],
  ["extreme", "voice", "Main tumhe abhi…", "“Main tumhe abhi…” se shuru karke vulgar line bolo", "Right now…", "Start with “Right now I want to…” and finish it dirty"],
  ["extreme", "photo", "Bold photo", "Apne collarbone / neck / lips ka thoda bold photo bhejo (comfortable ho to)", "Bold photo", "Send a slightly bold photo of your collarbone, neck or lips (only if you're comfortable)"],
]

const pick = (a: Avatar | undefined) => (_: string, he: string, she: string) => (a === "girl" ? she : he)

/** The dare as read by whoever does it (`you`), given by `them`, in `lang`. */
export const dareInfo = (i: number, you?: Avatar, them?: Avatar, lang: Lang = "hi") => {
  const [level, proof, titleHi, raw, titleEn, textEn] = DARES[i]
  const text = lang === "en" ? textEn : raw.replace(/\{(\w+)\|(\w+)\}/g, pick(you)).replace(/\[(\w+)\|(\w+)\]/g, pick(them))
  return { level, proof, title: lang === "en" ? titleEn : titleHi, text, seconds: SECONDS[proof], ...LEVELS[level] }
}
