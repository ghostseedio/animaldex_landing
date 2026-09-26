

export type SocialIdeaGenerationInput = {
  pages: Array<{
    id: string;
    platform: string;
    pageName: string;
    description: string;
    notes: string;
  }>;
  history: Array<{
    pageName: string;
    platform: string;
    title: string;
    hook: string;
    lengthSeconds: number;
    tips: string;
    status: string;
    projectedViews24h: number;
    actualViews24h: number | null;
  }>;
  dayLabel: string;
  totalIdeas: number;
};

export async function generateSocialIdeas(input: SocialIdeaGenerationInput) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured for this environment");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.7,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "growth_social_ideas",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              ideas: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    pageName: { type: "string" },
                    platform: { type: "string" },
                    title: { type: "string" },
                    hook: { type: "string" },
                    lengthSeconds: { type: "integer" },
                    postType: { type: "string" },
                    tips: { type: "string" },
                    projectedViews24h: { type: "integer" },
                    projectionConfidence: {
                      type: "string",
                      enum: ["low", "medium", "high"],
                    },
                    projectionReason: { type: "string" },
                  },
                  required: [
                    "pageName",
                    "platform",
                    "title",
                    "hook",
                    "lengthSeconds",
                    "postType",
                    "tips",
                    "projectedViews24h",
                    "projectionConfidence",
                    "projectionReason",
                  ],
                },
              },
            },
            required: ["ideas"],
          },
        },
      },
      messages: [
        {
          role: "system",
          content: [
            "You generate social post ideas for an admin dashboard.",
            "Voice: practical, specific, and brief.",
            "Use the supplied pages and descriptions as the source of truth.",
            "Never repeat a history title whose status is completed; unfinished suggestions may be revisited.",
            "Use history rows with actualViews24h to identify page-specific winning topics, hooks, formats, and lengths.",
            "Prefer new titles that apply patterns from higher-performing measured posts, while varying the subject and avoiding close copies.",
            "Estimate projectedViews24h for each idea using comparable measured rows from the same page and platform when available.",
            "Use low projection confidence when fewer than 5 measured rows are available for that page, medium for 5-19, and high only with at least 20 relevant measured rows.",
            "Do not imply that a projection is guaranteed or fabricate historical performance.",
            "Keep projectionReason brief and name the measured pattern or cold-start assumption used.",
            "Vary post type, length, and angle across the set.",
            "Return ideas for only the requested totalIdeas count.",
            "Each idea must fit the page description and platform.",
            "Suggest a length in seconds and one or two concise tips.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  const payload = await response.json() as {choices?: Array<{message?: {content?: string}}>};
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("The model returned nothing to read");
  return JSON.parse(content) as {
    ideas: Array<{
      pageName: string;
      platform: string;
      title: string;
      hook: string;
      lengthSeconds: number;
      postType: string;
      tips: string;
      projectedViews24h: number;
      projectionConfidence: "low" | "medium" | "high";
      projectionReason: string;
    }>;
  };
}

export type SocialIdeaProjectionBackfillInput = {
  pages: Array<{
    id: string;
    platform: string;
    pageName: string;
    description: string;
    notes: string;
  }>;
  history: Array<{
    pageName: string;
    platform: string;
    title: string;
    hook: string;
    lengthSeconds: number;
    tips: string;
    status: string;
    projectedViews24h: number;
    actualViews24h: number | null;
  }>;
  ideas: Array<{
    id: string;
    pageName: string;
    platform: string;
    title: string;
    hook: string;
    lengthSeconds: number;
    tips: string;
  }>;
  dayLabel: string;
};

export async function backfillSocialIdeaProjections(
  input: SocialIdeaProjectionBackfillInput,
) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured for this environment");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.4,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "growth_social_projection_backfill",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              ideas: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    id: { type: "string" },
                    projectedViews24h: { type: "integer" },
                    projectionConfidence: {
                      type: "string",
                      enum: ["low", "medium", "high"],
                    },
                    projectionReason: { type: "string" },
                  },
                  required: [
                    "id",
                    "projectedViews24h",
                    "projectionConfidence",
                    "projectionReason",
                  ],
                },
              },
            },
            required: ["ideas"],
          },
        },
      },
      messages: [
        {
          role: "system",
          content: [
            "You estimate 24-hour view projections for existing social post ideas.",
            "Voice: practical, specific, and brief.",
            "Use the supplied pages and descriptions as the source of truth.",
            "Use history rows with actualViews24h to identify page-specific winning topics, hooks, formats, and lengths.",
            "Never change the supplied idea ids, titles, hooks, or page names.",
            "Return one projection for every supplied idea id exactly once.",
            "Estimate projectedViews24h using measured history from the same page and platform when available.",
            "Use low projection confidence when fewer than 5 measured rows are available for that page, medium for 5-19, and high only with at least 20 relevant measured rows.",
            "Keep projectionReason brief and mention the pattern or assumption used.",
            "Do not output zeros for unresolved ideas unless the idea is truly expected to have no 24-hour traction.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `OpenAI request failed (${response.status}): ${detail.slice(0, 300)}`,
    );
  }
  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("The model returned nothing to read");
  return JSON.parse(content) as {
    ideas: Array<{
      id: string;
      projectedViews24h: number;
      projectionConfidence: "low" | "medium" | "high";
      projectionReason: string;
    }>;
  };
}
