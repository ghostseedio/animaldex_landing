export const DailyCompanionCopy = {
    featureTitle: "Daily Companion",
    dayPrompt: "What are you up to today?",
    dayHelper: "Tell AnimalDex what your day looks like. Your animals will build a plan around it.",
    findCompanion: "Find My Companion",
    animalPlan: "Animal Plan",
    companionAdvice: "Companion Advice",
    todaysTask: "Today's Task",
    showYouDidIt: "Show You Did It",
    growthMap: "Growth Map",
    yourDay: "Your day",
    companionToday: "Your Companion Today",
    taskComplete: "Completed today",
    comeBackTomorrow: "Come back tomorrow for a new training animal.",
    sharedToTimeline: "Shared to Discover.",
    keptProofPrivate: "Proof saved privately.",
    historyTitle: "Companion History",
    dailyTimeline: "Daily Timeline",
    selectDate: "Select Date",
    noHistoryTitle: "No companion history yet",
    noHistoryDetail: "Completed daily companions will appear here.",
    emptyTimeline: "Your completed journal history will appear here."
} as const;

export const dayQuickChips = [
    {id: "school", label: "School / study", insertText: "School, homework, and trying to stay focused."},
    {id: "work", label: "Work focus", insertText: "I need to stay focused and get work done today."},
    {id: "gym", label: "Gym / energy", insertText: "Gym later and I need steady energy through the day."},
    {id: "friends", label: "Friends / social", insertText: "I'm going out with friends but feel a bit nervous."},
    {id: "stress", label: "Stressful day", insertText: "Busy day. I need to stay calm and get things done."},
    {id: "creative", label: "Creative work", insertText: "I want to make progress on creative work today."},
    {id: "decision", label: "Big decision", insertText: "I need to make a clear decision before the day gets away from me."},
    {id: "confidence", label: "Need confidence", insertText: "I need a little more confidence to follow through today."},
    {id: "calm", label: "Need calm", insertText: "I want to stay calm and not rush the important parts."},
    {id: "normal", label: "Just a normal day", insertText: "Just a normal day with a few things to get done."}
] as const;

export type JournalStep = "problem" | "formula" | "results" | "map";

export const journalSteps: Array<{id: JournalStep; title: string; index: number}> = [
    {id: "problem", title: "Today", index: 0},
    {id: "formula", title: "Animal Plan", index: 1},
    {id: "results", title: "Today's Task", index: 2},
    {id: "map", title: "Growth Map", index: 3}
];
