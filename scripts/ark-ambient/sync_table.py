"""After make_beds.py: write each made bed's loop length, its sources (with the cut) and ready=true into
src/ark-scene/ambient-beds.json. Run from the landing repo root:

  python3 scripts/ark-ambient/sync_table.py --report <work>/report.json
"""

from __future__ import annotations

import argparse
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
TABLE = os.path.join("src", "ark-scene", "ambient-beds.json")

NPS = "National Park Service"
PD_GOV = "Public domain"
COMMONS = "Wikimedia Commons"
APOREE = "radio aporee ::: maps (Internet Archive)"

# Per source file: how it is credited. Licences checked on each page on 2026-11-11 (docs/ark-credits.md).
SOURCES = {
    "commons/Light_Rain_Distant_Thunder_July_5th_2016.wav": {"title": "Light Rain Distant Thunder July 5th 2016", "recordist": "kvgarlic", "license": "CC0 1.0", "source": COMMONS, "page": "https://commons.wikimedia.org/wiki/File:Light_Rain_Distant_Thunder_July_5th_2016.wav"},
    "commons/Rain_and_thunder_(1).ogg": {"title": "Rain and thunder", "recordist": "ezwa", "license": "Public domain", "source": COMMONS, "page": "https://commons.wikimedia.org/wiki/File:Rain_and_thunder_(1).ogg"},
    "commons/Country_night_noise.ogg": {"title": "Country night noise", "recordist": "hc", "license": "Public domain", "source": COMMONS, "page": "https://commons.wikimedia.org/wiki/File:Country_night_noise.ogg"},
    "commons/Waves.ogg": {"title": "Waves (Lake Ontario, Webster NY)", "recordist": "Dsw4", "license": "Public domain", "source": COMMONS, "page": "https://commons.wikimedia.org/wiki/File:Waves.ogg"},
    "nps/nri-Cricket.mp3": {"title": "Crickets, Mojave National Preserve", "recordist": NPS, "license": PD_GOV, "source": "NPS Sound Gallery", "page": "https://www.nps.gov/subjects/sound/sounds-crickets.htm"},
    "nps/romo-MoraineParkWesternchorusfrogsROMO51916Final.mp3": {"title": "Western Chorus Frogs in Moraine Park, Rocky Mountain NP", "recordist": "J. Job, National Park Service", "license": PD_GOV, "source": "NPS Rocky Mountain sound library", "page": "https://www.nps.gov/romo/learn/photosmultimedia/sounds-wildlife-soundscapes.htm"},
    "nps/yell-YELLDawnChorus.mp3": {"title": "Dawn Chorus, Mammoth Hot Springs, Yellowstone", "recordist": "Jennifer Jerrett, National Park Service", "license": PD_GOV, "source": "NPS Yellowstone sound library", "page": "https://www.nps.gov/yell/learn/photosmultimedia/sounds-dawnchorus.htm"},
    "nps/romo-FinchLakeAmbientROMO62016Final1.mp3": {"title": "Morning Soundscape from Finch Lake, Rocky Mountain NP", "recordist": "J. Job, National Park Service", "license": PD_GOV, "source": "NPS Rocky Mountain sound library", "page": "https://www.nps.gov/romo/learn/photosmultimedia/sounds-ambient-soundscapes.htm"},
    "nps/yell-040201LowerGeyserBasinWindInTreesBinaural01011.mp3": {"title": "Wind in the trees, Lower Geyser Basin, Yellowstone", "recordist": "Peter Comley, National Park Service", "license": PD_GOV, "source": "NPS Yellowstone sound library", "page": "https://www.nps.gov/yell/learn/photosmultimedia/sounds-soundscapes.htm"},
    "nps/romo-WindAmbientGemLakeROMO52516Final1.mp3": {"title": "Wind Soundscape from Gem Lake, Rocky Mountain NP", "recordist": "J. Job, National Park Service", "license": PD_GOV, "source": "NPS Rocky Mountain sound library", "page": "https://www.nps.gov/romo/learn/photosmultimedia/sounds-ambient-soundscapes.htm"},
    "nps/romo-StreamAmbientROMO52516BlackCanyonTrailFinal1.mp3": {"title": "Stream Soundscape from the Black Canyon Trail, Rocky Mountain NP", "recordist": "J. Job, National Park Service", "license": PD_GOV, "source": "NPS Rocky Mountain sound library", "page": "https://www.nps.gov/romo/learn/photosmultimedia/sounds-ambient-soundscapes.htm"},
    "nps/romo-MoraineWetlandAmbientROMO51816Final1.mp3": {"title": "Dawn Wetland Soundscape from Moraine Park, Rocky Mountain NP", "recordist": "J. Job, National Park Service", "license": PD_GOV, "source": "NPS Rocky Mountain sound library", "page": "https://www.nps.gov/romo/learn/photosmultimedia/sounds-ambient-soundscapes.htm"},
    "aporee/StrandNov2712.ogg": {"title": "Glassy Winter Surf, Silver Strand, Coronado CA", "recordist": "Rolf Yngve", "license": "Public Domain Mark 1.0", "source": APOREE, "page": "https://archive.org/details/aporee_15707_18266"},
    "aporee/wodospadsiklavica11041630.mp3": {"title": "Siklawica waterfall, Zakopane, Poland", "recordist": "alas23/sala", "license": "Public Domain Mark 1.0", "source": APOREE, "page": "https://archive.org/details/aporee_70170_81768"},
}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", required=True)
    ap.add_argument("--recipe", default=os.path.join(HERE, "beds.recipe.json"))
    args = ap.parse_args()
    with open(args.report, encoding="utf-8") as f:
        report = json.load(f)
    with open(args.recipe, encoding="utf-8") as f:
        recipes = {r["id"]: r for r in json.load(f)["beds"]}
    with open(TABLE, encoding="utf-8") as f:
        table = json.load(f)
    for bed in table["beds"]:
        made = report.get(bed["id"])
        if not made:
            continue
        recipe = recipes[bed["id"]]
        L = made["loop_seconds"]
        bed["loopSeconds"] = L
        bed["sources"] = [dict(SOURCES[layer["file"]], segment=[layer["start"], round(layer["start"] + L + recipe["crossfade"], 2)]) for layer in recipe["layers"]]
        bed["ready"] = all(os.path.exists(os.path.join("public", "ark", "sound", "ambient", f"{bed['id']}.{ext}")) for ext in ("webm", "m4a"))
    with open(TABLE, "w", encoding="utf-8") as f:
        f.write(json.dumps(table, indent=4, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
