import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileUpload } from "@/components/FileUpload";
import { GarmentGallery, type Garment } from "@/components/GarmentGallery";
import { TryOnPreview } from "@/components/TryOnPreview";
import { GarmentTypeSelector, type GarmentType } from "@/components/GarmentTypeSelector";
import { GenderSelector, type Gender } from "@/components/GenderSelector";
import { Sparkles, Zap, User } from "lucide-react";
import { toast } from "sonner";
import { composeTryOnImage } from "@/lib/ai";

export const FashionTryOn = () => {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [isGarmentSelectorOpen, setIsGarmentSelectorOpen] = useState(false);
  const [selectedGarmentType, setSelectedGarmentType] = useState<GarmentType | null>(null);
  const [selectedGender, setSelectedGender] = useState<Gender>("female");
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiImage, setAiImage] = useState<string | null>(null);

  // Cleanup effect to prevent memory leaks
  useEffect(() => {
    return () => {
      // Clean up all object URLs when component unmounts
      garments.forEach(garment => {
        URL.revokeObjectURL(garment.imageUrl);
      });
    };
  }, [garments]);

  const handleGarmentUpload = async (file: File, type: GarmentType) => {
    const id = crypto.randomUUID();
    const url = URL.createObjectURL(file);

    // Count existing garments of the same type for better naming
    const existingCount = garments.filter(g => g.type === type).length;
    const newGarment: Garment = {
      id,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${existingCount + 1}`,
      type,
      imageUrl: url,
      file,
      isActive: true, // Auto-activate new garments
    };

    console.log("[garment-upload] Adding new garment:", {
      id: newGarment.id,
      name: newGarment.name,
      type: newGarment.type,
      totalGarments: garments.length + 1
    });

    setGarments(prev => {
      const updatedGarments = [...prev, newGarment];
      console.log("[garment-upload] Updated garments list:", updatedGarments.map(g => ({
        id: g.id,
        name: g.name,
        type: g.type,
        isActive: g.isActive
      })));
      return updatedGarments;
    });

    // Clear previous image but don't auto-process
    setAiImage(null);

    // Reset the garment type selector to allow adding more garments
    setSelectedGarmentType(null);

    toast.success(`${newGarment.name} added! Click 'Generate Try-On' to see the result.`);
  };

  const handleGarmentTypeSelection = (type: GarmentType) => {
    setSelectedGarmentType(type);
  };

  const handleGarmentToggle = (id: string) => {
    setGarments(prev => {
      const updatedGarments = prev.map(garment => {
        if (garment.id === id) {
          const newActiveState = !garment.isActive;
          console.log("[garment-toggle] Toggling garment:", {
            id: garment.id,
            name: garment.name,
            oldState: garment.isActive,
            newState: newActiveState
          });
          return { ...garment, isActive: newActiveState };
        }
        return garment;
      });

      console.log("[garment-toggle] Updated garments:", updatedGarments.map(g => ({
        id: g.id,
        name: g.name,
        isActive: g.isActive
      })));

      return updatedGarments;
    });

    // Clear any previous AI result when selection changes to avoid stale previews
    setAiImage(null);

    // Find the garment from current state for toast message
    const garment = garments.find(g => g.id === id);
    if (garment) {
      toast.success(`${garment.name} ${garment.isActive ? 'removed from' : 'added to'} try-on`);
    }
  };

  const handleGarmentRemove = (id: string) => {
    const garment = garments.find(g => g.id === id);
    if (!garment) {
      console.warn("[garment-remove] Garment not found:", id);
      return;
    }

    console.log("[garment-remove] Removing garment:", {
      id: garment.id,
      name: garment.name,
      type: garment.type
    });

    setGarments(prev => {
      const updatedGarments = prev.filter(g => g.id !== id);
      console.log("[garment-remove] Updated garments list:", updatedGarments.map(g => ({
        id: g.id,
        name: g.name,
        type: g.type
      })));
      return updatedGarments;
    });

    // Clean up the object URL to prevent memory leaks
    URL.revokeObjectURL(garment.imageUrl);

    // Clear AI image if it was showing this garment
    setAiImage(null);

    toast.success(`${garment.name} removed from collection`);
  };

  const handleAIProcess = async () => {
    const activeGarments = garments.filter(g => g.isActive);

    console.log("[try-on] Starting AI process with garments:", {
      totalGarments: garments.length,
      activeGarments: activeGarments.length,
      activeGarmentDetails: activeGarments.map(g => ({
        id: g.id,
        name: g.name,
        type: g.type,
        hasFile: !!g.file,
        hasImageUrl: !!g.imageUrl
      }))
    });

    if (activeGarments.length === 0) {
      toast.error("Please add at least one garment to try on");
      return;
    }

    // Validate that all active garments have required data
    const invalidGarments = activeGarments.filter(g => !g.file || !g.imageUrl);
    if (invalidGarments.length > 0) {
      console.error("[try-on] Invalid garments found:", invalidGarments);
      toast.error("Some garments are missing data. Please re-upload them.");
      return;
    }

    // Validate that garment URLs are still valid (not expired blob URLs)
    const expiredGarments = activeGarments.filter(g => {
      if (g.imageUrl.startsWith('blob:')) {
        // Check if blob URL is still valid by trying to create an image
        try {
          const img = new Image();
          img.src = g.imageUrl;
          return false; // If no error thrown, URL is valid
        } catch {
          return true; // URL is expired
        }
      }
      return false;
    });

    if (expiredGarments.length > 0) {
      console.warn("[try-on] Found expired garment URLs:", expiredGarments);
      toast.error("Some garment images have expired. Please re-upload them.");
      return;
    }

    setIsProcessing(true);
    setAiImage(null); // Clear previous image while processing

    // Check if we have an API key to determine the generation method
    const hasApiKey = !!import.meta.env.VITE_GOOGLE_AI_API_KEY;

    if (hasApiKey) {
      if (activeGarments.length > 1) {
        toast.info(`Creating AI model wearing your ${activeGarments.length} garments as a complete outfit... This may take a few moments.`);
      } else {
        toast.info(`Creating AI model wearing your garment... This may take a few moments.`);
      }
    } else {
      toast.info(`Creating enhanced virtual try-on with ${activeGarments.length} garment${activeGarments.length > 1 ? 's' : ''}... This may take a few moments.`);
    }

    try {
      // Force a small delay to ensure UI updates
      await new Promise(resolve => setTimeout(resolve, 100));

      const composed = await composeTryOnImage({
        garments: activeGarments.map(g => ({
          url: g.imageUrl,
          type: g.type,
          file: g.file
        })),
        gender: selectedGender
      });

      if (!composed) {
        throw new Error("Failed to generate try-on image");
      }

      setAiImage(composed);

      // Provide feedback based on the generation method used
      if (hasApiKey) {
        toast.success(`AI model wearing your ${activeGarments.length} garment${activeGarments.length > 1 ? 's' : ''} generated! Check out your result.`);
      } else {
        toast.success(`Enhanced virtual try-on created with ${activeGarments.length} garment${activeGarments.length > 1 ? 's' : ''}! Using advanced canvas composition.`);
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("Failed to load any garment images")) {
          toast.error("Failed to load garment images. Please check your uploaded files and try again.");
        } else if (err.message.includes("Failed to load image")) {
          toast.error("Some garment images could not be loaded. Please re-upload them.");
        } else if (err.message.includes("503") || err.message.includes("Service Unavailable")) {
          toast.error("AI service is temporarily unavailable. Using enhanced canvas composition instead.");
        } else {
          toast.error(`Processing failed: ${err.message}`);
        }
      } else {
        toast.error("Processing failed. Please try again.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const activeGarments = garments.filter(g => g.isActive);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      {/* Hero Section */}
      {/* <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 fashion-gradient opacity-90" />
        <div className="relative z-10 container mx-auto px-4 py-16 text-center">
          <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="text-4xl md:text-6xl font-bold text-white">
              Virtual Fashion
              <span className="block fashion-accent-gradient bg-clip-text text-transparent">
                Try-On Studio
              </span>
            </h1>
            <p className="text-xl text-white/90">
              Experience the future of fashion with AI-powered virtual try-ons.
              Upload garments and see how they look on our standard model.
            </p>
            <div className="flex items-center justify-center gap-6 text-white/80">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                <span>AI-Powered</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                <span>Instant Results</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                <span>Personalized</span>
              </div>
            </div>
          </div>
        </div>
      </div> */}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Garment Upload */}
          <div className="space-y-6">
            {/* Gender Selection */}
            <GenderSelector
              selectedGender={selectedGender}
              onGenderChange={setSelectedGender}
            />

            {selectedGarmentType && (
              <FileUpload
                onFileUpload={(file) => handleGarmentUpload(file, selectedGarmentType)}
                uploadType="garment"
                title={`Add ${selectedGarmentType.charAt(0).toUpperCase() + selectedGarmentType.slice(1)}`}
                description="Upload a clear image of the garment on a plain background for best results"
              />
            )}

            {!selectedGarmentType && (
              <Card className="p-6 fashion-card text-center space-y-4">
                <h3 className="text-lg font-semibold">Add Garments</h3>
                <p className="text-sm text-muted-foreground">
                  Select a garment type to start adding items to your virtual try-on
                </p>
                <Button
                  variant="accent"
                  size="lg"
                  onClick={() => setIsGarmentSelectorOpen(true)}
                  className="w-full"
                >
                  <Sparkles className="h-5 w-5" />
                  Choose Garment Type
                </Button>
              </Card>
            )}

            {activeGarments.length > 0 && (
              <Card className="p-6 fashion-card text-center space-y-4">
                <h3 className="text-lg font-semibold">Ready to Generate?</h3>
                <p className="text-sm text-muted-foreground">
                  Click below to render your garments on a {selectedGender === "any" ? "model" : selectedGender} model
                </p>
                <div className="text-xs text-muted-foreground mb-4">
                  {activeGarments.length} garment{activeGarments.length !== 1 ? 's' : ''} active • {selectedGender === "any" ? "Any gender" : selectedGender} model
                </div>
                <Button
                  variant="accent"
                  size="lg"
                  onClick={handleAIProcess}
                  disabled={isProcessing}
                  className="w-full"
                >
                  <Sparkles className="h-5 w-5" />
                  {isProcessing ? "Processing..." : "Generate Try-On"}
                </Button>
              </Card>
            )}
          </div>

          {/* Center Column - Preview */}
          <div>
            <TryOnPreview
              modelImage={aiImage}
              activeGarments={activeGarments}
              isProcessing={isProcessing}
              isAiGenerated={!!aiImage}
            />
          </div>

          {/* Right Column - Garment Gallery */}
          <div>
            <GarmentGallery
              garments={garments}
              onGarmentToggle={handleGarmentToggle}
              onGarmentRemove={handleGarmentRemove}
              onAddMore={() => setIsGarmentSelectorOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* Garment Type Selector Modal */}
      <GarmentTypeSelector
        isOpen={isGarmentSelectorOpen}
        onTypeSelected={handleGarmentTypeSelection}
        onClose={() => setIsGarmentSelectorOpen(false)}
      />
    </div>
  );
};