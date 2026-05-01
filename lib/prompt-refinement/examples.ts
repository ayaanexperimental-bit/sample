import { analyzePrompt } from "./analyze-prompt";

const examplePrompts = [
  {
    label: "Low risk",
    prompt: "Create a checklist of assets needed before building the hero section."
  },
  {
    label: "High risk",
    prompt: "Write copy promising users can reverse PCOS in 30 days and stop medicines."
  },
  {
    label: "Ambiguous scope",
    prompt: "Build the whole site and complete automation all at once."
  }
];

export const promptAnalysisExamples = examplePrompts.map((example) => ({
  ...example,
  result: analyzePrompt({ prompt: example.prompt })
}));
