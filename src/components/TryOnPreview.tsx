import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Maximize2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Garment } from "./GarmentGallery";

interface TryOnPreviewProps {
  modelImage: string | null;
  activeGarments: Garment[];
  isProcessing?: boolean;
  isAiGenerated?: boolean;
}

export const TryOnPreview = ({ modelImage, activeGarments, isProcessing = false, isAiGenerated = false }: TryOnPreviewProps) => {

  const handleDownload = () => {
    // In a real implementation, this would download the final composed image
    console.log("Download functionality would be implemented here");
  };

  const handleReset = () => {
    // Reset to standard model
    console.log("Reset to standard model");
  };

  return (
    <Card className="p-6 fashion-card">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Model Preview</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm">
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button variant="fashion" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4" />
              Save
            </Button>
          </div>
        </div>

        <div className="relative">
          {/* Main Preview Area */}
          <div
            className={cn(
              "relative aspect-[3/4] bg-muted/30 rounded-lg overflow-hidden border-2 border-dashed border-border",
              isProcessing && "animate-pulse"
            )}
          >
            {modelImage ? (
              <div className="relative w-full h-full">
                {/* Model Image */}
                <img
                  src={modelImage}
                  alt="Model with garments"
                  className="w-full h-full object-cover"
                />

                {/* AI Processing Overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                      <p className="text-white text-sm font-medium">Processing with AI...</p>
                    </div>
                  </div>
                )}

                {/* Garment Overlays (Simulated) - Only show when NOT AI generated */}
                {!isProcessing && !isAiGenerated && activeGarments.map((garment, index) => {
                  // Calculate different positions for each garment type
                  let position = {};
                  switch (garment.type) {
                    case 'dress':
                      position = { top: '10%', left: '25%', width: '50%', height: '80%' };
                      break;
                    case 'tshirt':
                      // case 'top':
                      position = { top: '15%', left: '25%', width: '50%', height: '40%' };
                      break;
                    case 'footwear':
                      position = { top: '75%', left: '35%', width: '30%', height: '20%' };
                      break;
                    case 'accessory':
                      position = { top: '10%', left: '40%', width: '20%', height: '20%' };
                      break;
                    default:
                      position = { top: '20%', left: '25%', width: '50%', height: '50%' };
                  }

                  return (
                    <div
                      key={garment.id}
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        opacity: 0.9,
                        mixBlendMode: 'multiply',
                        zIndex: index + 1 // Ensure proper layering
                      }}
                    >
                      {/* Position based on garment type */}
                      <div
                        className="absolute opacity-90"
                        style={{
                          ...position,
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <img
                          src={garment.imageUrl}
                          alt={garment.name}
                          className="w-full h-full object-contain"
                          style={{
                            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-center">
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                    <Maximize2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Add garments to start</p>
                    <p className="text-xs text-muted-foreground">Your virtual try-on will appear here</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Active Garments Info */}
          {activeGarments.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Model is wearing:</p>
              <div className="flex flex-wrap gap-2">
                {activeGarments.map((garment) => (
                  <Badge key={garment.id} variant="secondary" className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                    {garment.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Status */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
            {isProcessing ? "AI Processing..." : isAiGenerated ? "AI Generated Try-On" : "Ready for AI Enhancement"}
          </div>
        </div>
      </div>
    </Card>
  );
};