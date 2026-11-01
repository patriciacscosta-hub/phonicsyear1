# Phonics Space Quest 🚀

A space-themed web app that helps 5–6 year olds get ready for the **Year 1 Phonics Screening Check**, following the **Read Write Inc. (RWI)** Speed Sound order.

## Levels

| | Game | What the child does |
|---|---|---|
| Warm up | **Speed Sounds** | Tap a Set 1, 2 or 3 sound to hear it, with its RWI picture word or phrase ("ay – may I play"). |
| Level 1 | **Alien or Earth?** | Read a word and drag it to **Earth** (real word) or the **alien planet** (alien/nonsense word), like the alien words in the real check. They get a big ✓ or ✗. They can tap the sound buttons to Fred Talk first. Tapping a planet also works. |
| Level 2 | **Find the Word** | The app says a real or alien word. The child taps the matching word out of three that differ by one sound (e.g. *shop / ship / chop*), so they have to read every sound. They get a ✓ or ✗ and can try again. |

Each level has four missions: **Set 1**, **Set 2**, **Set 3** and **Check practice** (all sets mixed). A round is 10 words. The child earns up to 3 stars, saved on the device.

## RWI features

- Sound buttons: a **dot** under single-letter sounds, a **dash** under "special friends" (sh, ch, ay, igh…), and a **curved line** joining split digraphs (a-e, i-e, o-e, u-e).
- Sounds are grouped exactly as Set 1 → Set 2 → Set 3.
- Wrong choices never use a grapheme that makes the same sound (e.g. *ay / ai / a-e*), so a child is never marked wrong for a correct reading.
- Uses the Andika font, which has the single-storey **a** and **g** children learn to write.

## Running it

It's plain HTML, CSS and JavaScript with no build step. Open `index.html` or turn on **GitHub Pages** (Settings → Pages → Deploy from branch → `main` / root) and open the link on a tablet.

Audio uses the device's built-in voice (British English if the device has one). Built-in voices can't say pure RWI sounds perfectly, so a grown-up modelling the sounds is still best.

## Changing the words

All words live in [`js/data.js`](js/data.js). Write each word as sounds separated by spaces, e.g. `'sh i p'` or `'c a_e k'`.
