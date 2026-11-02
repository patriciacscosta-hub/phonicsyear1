# Phonics Space Quest 🚀

A space-themed web app that helps 5–6 year olds get ready for the **Year 1 Phonics Screening Check**, following the **Read Write Inc. (RWI)** Speed Sound order.

## Levels

| | Game | What the child does |
|---|---|---|
| Warm up | **Speed Sounds** | Tap a Set 1, 2 or 3 sound to hear it, with its RWI picture word or phrase ("ay – may I play"). |
| Level 1 | **Alien or Earth?** | Read a word and drag it to **Earth** (real word) or the **alien planet** (alien/nonsense word), like the alien words in the real check. They get a big ✓ or ✗. Tapping a planet also works. |
| Level 2 | **Find the Word** | The app says a real or alien word. The child taps the matching word out of three that differ by one sound (e.g. *shop / ship / chop*), so they have to read every sound. They get a ✓ or ✗ and can try again. |
| Level 3 | **Practice Check** | A full rehearsal of the real check. There are **20 numbered checks**, plus a **Surprise check** with a new mix every time. Each one has an unscored practice page, then **40 words in 2 sections, 4 per page**, with alien words first and an alien picture beside them. The child reads aloud and a grown-up taps ✓ or ✗. At the end you get the score out of 40 compared with the **32/40** expected standard, a breakdown by section and real/alien words, and a list of words to practise. Best scores are saved for each check. |

Levels 1 and 2 each have four missions: **Set 1**, **Set 2**, **Set 3** and **Check practice** (all sets mixed). A round is 10 words. The child earns up to 3 stars, saved on the device.

## RWI features

- Words are shown plain, with no sound buttons (dots and dashes), so the child has to spot the special friends and split digraphs themselves, as in the real check.
- Sounds are grouped exactly as Set 1 → Set 2 → Set 3.
- Wrong choices never use a grapheme that makes the same sound (e.g. *ay / ai / a-e*), so a child is never marked wrong for a correct reading.
- Uses the Andika font, which has the single-storey **a** and **g** children learn to write.

## Running it

It's plain HTML, CSS and JavaScript with no build step. Open `index.html` or turn on **GitHub Pages** (Settings → Pages → Deploy from branch → `main` / root) and open the link on a tablet.

Audio uses the device's built-in voice (British English if the device has one). Built-in voices can't say pure RWI sounds perfectly, so a grown-up modelling the sounds is still best.

## Changing the words

The word bank has about 360 words. All words live in [`js/data.js`](js/data.js). Write each word as sounds separated by spaces, e.g. `'sh i p'` or `'c a_e k'`.
