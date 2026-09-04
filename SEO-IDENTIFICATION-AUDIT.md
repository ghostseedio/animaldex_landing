# AnimalDex Identification SEO Architecture Audit

## Audit Date: 2026-09-04

## Objective
Determine the cleanest SEO architecture for the identification cluster before adding new pages, avoiding keyword cannibalization and preserving existing authority.

## Summary of Findings

### Current Identification-Related Pages

#### Answer Pages (/[slug])
| URL | Current Intent | Current Status | Overlap | GSC Evidence | Recommendation | Target Query Cluster | Reason |
|-----|----------------|----------------|---------|--------------|----------------|---------------------|--------|
| `/best-animal-identification-app` | Compare animal identification apps (AnimalDex vs competitors) | Published, indexable | High overlap with `/animal-identifier-app` and `/ai-animal-scanner` | Yes - position ~24 for "animal identification app" | KEEP AND IMPROVE as COMPARISON PAGE | "best animal identification app", "animal identification app comparison" | Strong existing authority, unique comparison content |
| `/animal-identifier-app` | What an animal identifier app should do; broad identification | Published, indexable | High overlap with `/best-animal-identification-app` and `/ai-animal-scanner` | Yes - impressions/clicks exist | MAKE PRIMARY BROAD IDENTIFICATION PAGE | "animal identifier app", "animal identification app", "identify animal from photo", "identify animal by picture", "animal photo identifier", "wildlife identification app" | Direct intent match, strong content foundation, good balance of features |
| `/ai-animal-scanner` | How AI animal scanners work and which app to use | Published, indexable | High overlap with `/animal-identifier-app` | No specific GSC mentioned | MERGE into `/animal-identifier-app` | - | Too similar intent, cannibalizes broad terms |
| `/identify-reptiles` | Reptile identification from photos | Published, indexable | Low (specialized) | Yes - position ~8.6 for "identify lizard from photo" | KEEP AND IMPROVE | "identify reptiles", "reptile identifier app", "identify reptiles from photo", "snake identifier app", "lizard identifier app", "herping field journal" | Specialized intent, existing authority, unique reptile-specific content |
| `/identify-birds` | Bird identification from photos/sightings | Published, indexable | Low (specialized) | No specific GSC mentioned | KEEP AND IMPROVE | "identify birds", "bird identifier app", "identify birds from photo", "import bird photography Instagram archive" | Specialized intent, unique bird-specific content including Instagram import |
| `/identify-insects` | Insect identification from photos | Published, indexable | Low (specialized) | No specific GSC mentioned | KEEP AND IMPROVE | "identify insects", "insect identifier app", "bug identifier app", "identify insects from photo" | Specialized intent, unique insect-specific content |
| `/identify-pets` | Pet and pet breed identification from photos | Published, indexable | Low (specialized) | No specific GSC mentioned | KEEP AND IMPROVE | "identify pets", "pet breed identifier", "pet identifier app", "identify pet breed from photo", "animal breed identifier" | Specialized intent, unique pet-specific content |

#### Use Case Pages (/use-cases/[slug])
| URL | Current Intent | Current Status | Overlap | GSC Evidence | Recommendation | Target Query Cluster | Reason |
|-----|----------------|----------------|---------|--------------|----------------|---------------------|--------|
| `/use-cases/ai-animal-scanner-identification-app` | AI animal scanner and identification app for real-world sightings | Published, indexable | High overlap with `/animal-identifier-app` | No specific GSC mentioned | REDIRECT to `/animal-identifier-app` | - | Cannibalizes broad identification intent |
| `/use-cases/animal-breed-identifier-lookalike-guide-app` | Animal breed identifier and lookalike guide | Published, indexable | Low (specialized) | No specific GSC mentioned | KEEP AND IMPROVE | "animal breed identifier", "animal breed detector", "identify pet breeds", "animal identification app" | Specialized breed-focused intent, complements main identification |
| `/use-cases/herping-field-journal` | Herping field journal & reptile collection app | Published, indexable | Low (specialized) | No specific GSC mentioned | KEEP AND IMPROVE | "herping app", "reptile tracking app", "snake identification journal", "herping field journal" | Specialized herping/reptile intent, unique field journal content |

## Proposed Final Identification IA

### Primary Broad Identifier
**`/animal-identifier-app`**
- Owns core intent: animal identifier, identify animal from photo, identify animal by picture, animal identification app, animal photo identifier, wildlife identification app
- Strengthen with: clearer title, focused meta description, consolidated content from `/ai-animal-scanner` and `/use-cases/ai-animal-scanner-identification-app`
- Add canonical to this page from any duplicate content

### Specialist Pages (Keep and Improve)
1. `/identify-reptiles` - Reptile identification
2. `/identify-birds` - Bird identification
3. `/identify-insects` - Insect identification
4. `/identify-pets` - Pet identification
5. `/use-cases/animal-breed-identifier-lookalike-guide-app` - Animal breed identification
6. `/use-cases/herping-field-journal` - Herping/reptile field journal
7. `/best-animal-identification-app` - App comparison page (reposition as comparison, not direct identification)

### Redirect/Canonical Candidates
1. `/ai-animal-scanner` → 301 redirect to `/animal-identifier-app`
2. `/use-cases/ai-animal-scanner-identification-app` → 301 redirect to `/animal-identifier-app`
3. Any other duplicate routes (e.g., `/id/` prefix routes) should be canonicalized or redirected

### Support/Use-Case Pages
- `/best-animal-identification-app` - Reposition as a comparison guide, not direct identification
- `/use-cases/import-instagram-wildlife-photos` - Supports all identification workflows

## Key Recommendations

### 1. Establish `/animal-identifier-app` as Primary
- **Update metadata**: Optimize title and meta description for core intent
- **Consolidate content**: Merge relevant content from `/ai-animal-scanner`
- **Strengthen canonical**: Ensure all duplicate pages point to this URL
- **Improve internal links**: Add strong internal linking from homepage and other relevant pages

### 2. Improve Specialist Pages
- For each specialist page:
  - Ensure content is genuinely category-specific
  - Add clear safety warnings for dangerous animals (especially snakes/reptiles)
  - Avoid generic scanner copy with just a different animal word
  - Include category-specific features, use cases, and tips

### 3. Fix Redirects/Canonicals
- Implement 301 redirects for `/ai-animal-scanner` and `/use-cases/ai-animal-scanner-identification-app`
- Check for any other duplicate routes (e.g., `/id/` prefix) and canonicalize appropriately

### 4. Address Safety Claims
- For `/identify-reptiles` and other dangerous animal pages:
  - Add clear warning not to handle or approach unknown animals
  - Frame identification confidence appropriately
  - Avoid medical/safety claims
  - Emphasize respectful observation from a safe distance

### 5. Monitor and Maintain
- Track GSC performance of primary page after changes
- Monitor for new cannibalization issues
- Regularly update content to maintain relevance

## Safety Considerations

For all identification pages:
- Don't claim 100% accuracy
- Don't claim species-level certainty where only group-level is possible
- Clearly communicate identification limitations
- For dangerous animals, prioritize safety warnings

## Implementation Steps (Phase 1)

1. Update `/animal-identifier-app` metadata and content
2. Implement 301 redirects for `/ai-animal-scanner` and `/use-cases/ai-animal-scanner-identification-app`
3. Update internal links to point to primary page
4. Improve specialist pages with category-specific content and safety warnings
5. Check and fix canonical tags
6. Monitor GSC performance for 2-4 weeks
