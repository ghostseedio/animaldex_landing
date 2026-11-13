# Privacy Policy and Terms: the capture regime (draft for the owner)

Branch `legal-capture-regime`. A draft only: nothing here is merged or deployed until you approve it.

## Why

Production runs the Ark's capture regime (`capture_arrivals` on, AnimalDex `docs/ark/DECISIONS.md` decision 6). A successful capture brings an animal aboard the shared Ark, and steps that work keep that person's animals of the kind thriving. The server refuses step arrivals.

The Privacy Policy and Terms published on 12 November still say a worked step brings an animal aboard. They never say that a capture does, or that a capture now puts the capturer's username on a public Ark animal by default. This draft makes both pages say what the product does.

What is collected and how it is used does not change. The pages now describe what already happens.

## The changes

### Privacy Policy (`src/data/privacy-policy.md`)

1. **Effective date** (line 2)
   - Before: Effective November 12, 2026
   - After: Effective November 13, 2026
   - Set it to the day you publish, if that is later.

2. **How we use information, item 5** (line 30)
   - Before: "Operate the shared Ark: show which animals came aboard after a user's step worked, who brought them (as described under "The shared Ark" below), and the short stories users choose to share."
   - After: "Operate the shared Ark: bring an animal aboard when a user's capture identifies it, show who brought it (as described under "The shared Ark" below), show how well their animals are doing as the steps they work on go well, and show the short stories users choose to share."
   - In plain words: captures bring the animals, not steps. Steps now only change how well the animals are doing.

3. **The shared Ark, opening paragraph** (line 51)
   - Before: "When a small step a user worked on with an animal goes well, that animal can come aboard the shared Ark, which anyone can visit on the website and in the app."
   - After: "When a user's capture identifies an animal, one of its kind can come aboard the shared Ark, which anyone can visit on the website and in the app. Each person can have up to two living animals of a species aboard, and only species with a 3D model can come aboard; a capture of a species whose model isn't ready yet waits until it is. Captures saved before the Ark opened brought animals aboard in the same way. When a small step a user worked on with an animal goes well, their animals of that kind on the Ark do better. The Ark shows how well each animal is doing (ordinary, good or prime), never what anyone talked about."
   - In plain words, this paragraph now covers:
     - a capture brings the animal;
     - the limit of two per species, and the wait for a 3D model;
     - captures from before the launch were brought aboard too (the backfill);
     - steps make your animals do better, and the public Ark shows only a three-step condition, never a conversation.

4. **Stories are only shared by choice, item 3** (line 55)
   - Before: "After an animal comes aboard, the user can choose to share how the step worked: …"
   - After: "After a step works with an animal of a kind they have aboard, the user can choose to share how the step worked on that animal: …"
   - In plain words: the story is shared after a step that worked, on the animal the person already has aboard. An animal's arrival no longer triggers it. The rest of the item (only by choice, never filled in for them, editable, 18+ only) is unchanged.

5. **Your choices, item 8** (line 83)
   - Before: "Share, edit or remove the story of how a step brought an animal aboard the Ark."
   - After: "Share, edit or remove the story of how a step worked with one of their animals on the Ark."

Unchanged, and already right:
- item 1, "Who brought it": username shown by default, the opt-out, Voyager for under 18s and for people without a username, where a photo was taken never shown;
- the screening item;
- the deletion item;
- the "Show my name on my Ark animals" choice (item 7).

### Terms of Use (`src/data/terms-of-service.md`)

1. **Effective date** (line 2): November 12 → November 13, 2026 (or the day you publish).

2. **User Content, the Ark paragraph** (line 34)
   - Before: "When your step brings an animal aboard the shared Ark, your username (linked to your profile), display name and avatar are shown on that animal by default, … You can turn this off in Settings ("Show my name on my Ark animals"). When you confirm …"
   - After: "When your capture brings an animal aboard the shared Ark, your username (linked to your profile), display name and avatar are shown on that animal by default, … You can turn this off in Settings ("Show my name on my Ark animals"). Steps that work with an animal keep your animals of that kind thriving on the Ark. When you confirm …"
   - In plain words: it is your capture that puts your name on a public Ark animal, and steps keep those animals thriving. The rest of the paragraph (the 18+ confirmation, stories are public) is unchanged.

## The setting the pages name

The setting is "Show my name on my Ark animals", in Settings on all three surfaces:
- iOS: `ArkFounderCopy.settingsTitle`, at the end of Record privacy;
- Android: `ArkFounderSettings.TITLE`, at the end of Record privacy;
- web: the Ark section of `/app/settings`.

It is on by default. Turning it off shows the person as a Voyager number on all their animals at once. The pages already named it this way; only the cause (capture, not step) changed.

## For you to decide before publishing

1. **The effective date.** Change it to the day you publish.
2. **The backfill sentence.** "Captures saved before the Ark opened brought animals aboard in the same way" says that pre-launch captures (the 3,140 backfilled animals) also show their capturer's username by default. That is what production does. Keep it if you want that said openly, which I recommend. Remove it if you would rather the pages describe only the rule going forward.
3. **The public condition band.** The pages now say the Ark shows how well each animal is doing (ordinary, good or prime). That band is public, and it moves when the person who brought the animal has steps that work. It shows that someone has been working on steps with that kind of animal, though never what about. It is not a new data use: under the old rule, an animal's arrival showed a worked step more directly. It is now said explicitly.
4. **Other copies.**
   - Neither app's code on `main` carries a copy of these sentences (checked 2026-11-13).
   - The internal working draft `docs/ark/founders-privacy.md` on landing still has the old wording. It is not shown to users.
   - If the App Store or Play privacy answers quote the old Ark sentence anywhere, they need the same change.
