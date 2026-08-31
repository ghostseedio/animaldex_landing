import React, { useState, useEffect } from "react";
import { Wizard, WizardStep } from "@/app/admin/sponsored-challenges/components/wizard-layout";
import { type CampaignDraftInput, type AdminCampaignDetail } from "@/lib/sponsored-challenges-admin";

interface CampaignWizardProps {
  initialData?: AdminCampaignDetail | null;
  onSave: (data: CampaignDraftInput) => Promise<void>;
  onCancel: () => void;
}

export function CampaignWizard({ initialData, onSave, onCancel }: CampaignWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [venueName, setVenueName] = useState("");
  const [campaignData, setCampaignData] = useState<CampaignDraftInput>({
    slug: "",
    title: "",
    publicSummary: "",
    description: "",
    presenterName: "",
    sponsorOrganizationId: null,
    startsAt: new Date().toISOString().slice(0, 16),
    endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    timezoneIdentifier: "UTC",
    objectiveType: "eligible_capture_count",
    targetCount: 100,
    officialRules: "",
    rewardTerms: "",
    requiredTypeTag: null,
    requiredSettingTag: null,
    minimumCaptureGrade: null,
    liveOnly: false,
    externalImportsAllowed: true,
    discoveryRadiusM: null,
    geoMode: "unrestricted",
    hasVenue: false,
    ...initialData
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = [
    "Basic Info",
    "Targeting", 
    "Venue",
    "Rewards",
    "Review"
  ];

  const handleSaveStep = async (stepData: Partial<CampaignDraftInput>) => {
    try {
      setIsLoading(true);
      setCampaignData(prev => ({ ...prev, ...stepData }));
      await onSave({ ...campaignData, ...stepData });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save progress");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Step components
  const renderStepContent = (step: number) => {
    switch(step) {
      case 0:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-display">Campaign Details</h2>
            
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-bold uppercase tracking-[.12em] text-ink-500 mb-2">Title *</label>
                <input
                  type="text"
                  value={campaignData.title}
                  onChange={(e) => setCampaignData({...campaignData, title: e.target.value})}
                  className="w-full rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-white focus:border-primary-300"
                  placeholder="Enter campaign title"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold uppercase tracking-[.12em] text-ink-500 mb-2">Slug *</label>
                <input
                  type="text"
                  value={campaignData.slug}
                  onChange={(e) => setCampaignData({...campaignData, slug: e.target.value})}
                  className="w-full rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-white focus:border-primary-300"
                  placeholder="Enter URL slug"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold uppercase tracking-[.12em] text-ink-500 mb-2">Public Summary</label>
                <textarea
                  value={campaignData.publicSummary}
                  onChange={(e) => setCampaignData({...campaignData, publicSummary: e.target.value})}
                  rows={3}
                  className="w-full rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-white focus:border-primary-300"
                  placeholder="Brief description for users"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold uppercase tracking-[.12em] text-ink-500 mb-2">Description</label>
                <textarea
                  value={campaignData.description}
                  onChange={(e) => setCampaignData({...campaignData, description: e.target.value})}
                  rows={4}
                  className="w-full rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-white focus:border-primary-300"
                  placeholder="Detailed campaign description"
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={handleNext}
                disabled={!campaignData.title || !campaignData.slug}
                className="rounded-xl bg-primary-400 px-4 py-2 text-sm font-black text-canvas-950 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        );
      
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-display">Targeting Settings</h2>
            
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-bold uppercase tracking-[.12em] text-ink-500 mb-2">Objective Type</label>
                <select
                  value={campaignData.objectiveType}
                  onChange={(e) => setCampaignData({...campaignData, objectiveType: e.target.value})}
                  className="w-full rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-white focus:border-primary-300"
                >
                  <option value="eligible_capture_count">Eligible capture count</option>
                  <option value="unique_indexed_entries">Unique indexed entries</option>
                  <option value="active_capture_days">Active capture days</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold uppercase tracking-[.12em] text-ink-500 mb-2">Target Count *</label>
                <input
                  type="number"
                  value={campaignData.targetCount}
                  onChange={(e) => setCampaignData({...campaignData, targetCount: parseInt(e.target.value) || 1})}
                  min="1"
                  className="w-full rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-white focus:border-primary-300"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold uppercase tracking-[.12em] text-ink-500 mb-2">Required Type Tag</label>
                <input
                  type="text"
                  value={campaignData.requiredTypeTag || ""}
                  onChange={(e) => setCampaignData({...campaignData, requiredTypeTag: e.target.value})}
                  className="w-full rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-white focus:border-primary-300"
                  placeholder="e.g. Bird, Mammal, etc."
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold uppercase tracking-[.12em] text-ink-500 mb-2">Required Setting Tag</label>
                <select
                  value={campaignData.requiredSettingTag || ""}
                  onChange={(e) => setCampaignData({...campaignData, requiredSettingTag: e.target.value})}
                  className="w-full rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-white focus:border-primary-300"
                >
                  <option value="">Any setting</option>
                  <option value="Wild">Wild</option>
                  <option value="Zoo">Zoo</option>
                  <option value="Farm">Farm</option>
                  <option value="Domestic">Domestic</option>
                  <option value="Unknown">Unknown</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold uppercase tracking-[.12em] text-ink-500 mb-2">Minimum Capture Grade</label>
                <input
                  type="number"
                  value={campaignData.minimumCaptureGrade || ""}
                  onChange={(e) => setCampaignData({...campaignData, minimumCaptureGrade: e.target.value ? parseInt(e.target.value) : null})}
                  min="1"
                  max="10"
                  className="w-full rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-white focus:border-primary-300"
                />
              </div>
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={handleBack}
                className="rounded-xl border border-line-300 px-4 py-2 text-sm font-bold text-white"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                className="rounded-xl bg-primary-400 px-4 py-2 text-sm font-black text-canvas-950"
              >
                Next
              </button>
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-display">Venue Configuration</h2>
            
            <div className="grid gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="has-venue"
                  checked={campaignData.hasVenue}
                  onChange={(e) => setCampaignData({...campaignData, hasVenue: e.target.checked})}
                  className="mr-2"
                />
                <label htmlFor="has-venue" className="text-sm font-bold text-white">Use venue-based participation</label>
              </div>
              
              {campaignData.hasVenue ? (
                <>
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-[.12em] text-ink-500 mb-2">Venue Name *</label>
                    <input
                      type="text"
                      value={venueName}
                      onChange={(e) => setVenueName(e.target.value)}
                      className="w-full rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-white focus:border-primary-300"
                      placeholder="Name of venue"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold uppercase tracking-[.12em] text-ink-500 mb-2">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        className="w-full rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-white focus:border-primary-300"
                        placeholder="Latitude"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold uppercase tracking-[.12em] text-ink-500 mb-2">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        className="w-full rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-white focus:border-primary-300"
                        placeholder="Longitude"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-[.12em] text-ink-500 mb-2">Validation Radius (m)</label>
                    <input
                      type="number"
                      min="25"
                      max="50000"
                      value="400"
                      className="w-full rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-white focus:border-primary-300"
                    />
                  </div>
                  
                  <p className="text-xs text-ink-400">Note: Venue participation forces live_only = true and external_imports_allowed = false</p>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-[.12em] text-ink-500 mb-2">Discovery Mode</label>
                    <select
                      value={campaignData.geoMode}
                      onChange={(e) => setCampaignData({...campaignData, geoMode: e.target.value as any})}
                      className="w-full rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-white focus:border-primary-300"
                    >
                      <option value="unrestricted">Unrestricted</option>
                      <option value="allowlist">Allowlist</option>
                      <option value="denylist">Denylist</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-[.12em] text-ink-500 mb-2">Country Codes (comma separated)</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-white focus:border-primary-300"
                      placeholder="e.g. US, CA, GB"
                    />
                  </div>
                </>
              )}
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={handleBack}
                className="rounded-xl border border-line-300 px-4 py-2 text-sm font-bold text-white"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                className="rounded-xl bg-primary-400 px-4 py-2 text-sm font-black text-canvas-950"
              >
                Next
              </button>
            </div>
          </div>
        );
      
      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-display">Rewards</h2>
            
            <div className="grid gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="cash-enabled"
                  checked={true}
                  onChange={() => {}}
                  className="mr-2"
                />
                <label htmlFor="cash-enabled" className="text-sm font-bold text-white">Enable cash rewards (Cash + Achievement)</label>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold uppercase tracking-[.12em] text-ink-500 mb-2">Reward Amount ($)</label>
                  <input
                    type="number"
                    value="5.00"
                    className="w-full rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-white focus:border-primary-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold uppercase tracking-[.12em] text-ink-500 mb-2">Recipients</label>
                  <input
                    type="number"
                    value="500"
                    className="w-full rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-white focus:border-primary-300"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold uppercase tracking-[.12em] text-ink-500 mb-2">Cash Service Fee</label>
                <input
                  type="number"
                  value="0.25"
                  className="w-full rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-white focus:border-primary-300"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold uppercase tracking-[.12em] text-ink-500 mb-2">Achievement Name</label>
                <input
                  type="text"
                  value="Challenge Completion"
                  className="w-full rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-white focus:border-primary-300"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold uppercase tracking-[.12em] text-ink-500 mb-2">Achievement Description</label>
                <textarea
                  rows={2}
                  className="w-full rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-white focus:border-primary-300"
                  placeholder="Description of achievement"
                ></textarea>
              </div>
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={handleBack}
                className="rounded-xl border border-line-300 px-4 py-2 text-sm font-bold text-white"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                className="rounded-xl bg-primary-400 px-4 py-2 text-sm font-black text-canvas-950"
              >
                Next
              </button>
            </div>
          </div>
        );
      
      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-display">Review & Save</h2>
            
            <div className="space-y-4">
              <div className="rounded-xl border border-line-300 bg-canvas-950 p-4">
                <h3 className="font-bold text-white mb-2">Campaign Overview</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-ink-500">Title:</span>
                  <span className="text-white">{campaignData.title}</span>
                  <span className="text-ink-500">Target Count:</span>
                  <span className="text-white">{campaignData.targetCount}</span>
                  <span className="text-ink-500">Objective:</span>
                  <span className="text-white capitalize">{campaignData.objectiveType.replace('_', ' ')}</span>
                  <span className="text-ink-500">Venue:</span>
                  <span className="text-white">{campaignData.hasVenue ? "Yes" : "No"}</span>
                </div>
              </div>
              
              <div className="rounded-xl border border-line-300 bg-canvas-950 p-4">
                <h3 className="font-bold text-white mb-2">Rewards</h3>
                <div className="text-sm">
                  <p className="text-white">$5.00 per participant</p>
                  <p className="text-white">500 recipients maximum</p>
                  <p className="text-white">Cash + Achievement reward</p>
                </div>
              </div>
            </div>
            
            {error && (
              <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4">
                <p className="text-sm text-rose-100">{error}</p>
              </div>
            )}
            
            <div className="flex justify-between">
              <button
                onClick={handleBack}
                className="rounded-xl border border-line-300 px-4 py-2 text-sm font-bold text-white"
              >
                Back
              </button>
              <button
                onClick={() => {
                  // Finish campaign creation
                  onSave(campaignData);
                }}
                className="rounded-xl bg-primary-400 px-4 py-2 text-sm font-black text-canvas-950 disabled:opacity-50"
              >
                Save Campaign
              </button>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Wizard currentStep={currentStep} steps={steps} onStepChange={setCurrentStep}>
        {renderStepContent(currentStep)}
      </Wizard>
    </div>
  );
}
