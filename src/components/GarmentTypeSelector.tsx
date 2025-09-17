import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shirt, Footprints, Watch, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type GarmentType = 'tshirt' | 'footwear' | 'accessory' | 'dress' | 'pants' | 'shorts';

interface GarmentTypeSelectorProps {
  onTypeSelected: (type: GarmentType) => void;
  onClose: () => void;
  isOpen: boolean;
}

const garmentTypes = [
  {
    type: 'tshirt' as GarmentType,
    label: 'T-Shirts & Tops',
    icon: Shirt,
    description: 'Shirts, t-shirts, blouses, and tops',
    color: 'bg-blue-500',
  },
  {
    type: 'pants' as GarmentType,
    label: 'Pants',
    icon: Zap,
    description: 'Jeans, trousers, and long pants',
    color: 'bg-indigo-500',
  },
  {
    type: 'shorts' as GarmentType,
    label: 'Shorts',
    icon: Zap,
    description: 'Shorts, bermudas, and short pants',
    color: 'bg-orange-500',
  },
  {
    type: 'dress' as GarmentType,
    label: 'Dresses',
    icon: Shirt,
    description: 'Dresses and one-piece outfits',
    color: 'bg-pink-500',
  },
  {
    type: 'footwear' as GarmentType,
    label: 'Footwear',
    icon: Footprints,
    description: 'Sneakers, shoes, boots, and sandals',
    color: 'bg-green-500',
  },
  {
    type: 'accessory' as GarmentType,
    label: 'Accessories',
    icon: Watch,
    description: 'Watches, jewelry, bags, and accessories',
    color: 'bg-purple-500',
  },
];

export const GarmentTypeSelector = ({ onTypeSelected, onClose, isOpen }: GarmentTypeSelectorProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md p-6 fashion-card">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Select Garment Type</h3>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-3">
            {garmentTypes.map((garmentType) => {
              const IconComponent = garmentType.icon;
              return (
                <Button
                  key={garmentType.type}
                  variant="outline"
                  className="w-full h-auto p-4 justify-start"
                  onClick={() => {
                    onTypeSelected(garmentType.type);
                    onClose();
                  }}
                >
                  <div className="flex items-center gap-4 w-full">
                    <div className={cn("p-2 rounded-lg", garmentType.color)}>
                      <IconComponent className="h-6 w-6 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{garmentType.label}</p>
                      <p className="text-sm text-muted-foreground">{garmentType.description}</p>
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
};