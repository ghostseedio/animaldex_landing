/**
 * Server-side poster frames. Imported only by server components (the public
 * Animal Trials hub), so the glyph table stays out of the client bundle while
 * the finished-state frame is in the HTML before any script runs.
 */

import glyphs from "./glyphs.json";
import vocabulary from "./vocabulary.json";
import {renderTrialMotionPosterMarkup} from "./engine";
import {parseTrialStoryboard} from "./storyboard";

/** The poster as inner SVG markup, or null when there is no drawable storyboard. */
export function trialMotionPosterMarkup(storyboard: unknown): string | null {
    const parsed = parseTrialStoryboard(storyboard);
    return parsed ? renderTrialMotionPosterMarkup(parsed, vocabulary, glyphs) : null;
}
