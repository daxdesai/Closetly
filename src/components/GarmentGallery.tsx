import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Shirt, Footprints, Watch } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Garment {
  id: string;
  name: string;
  type: 'tshirt' | 'footwear' | 'accessory' | 'dress';
  imageUrl: string;
  file: File;
  isActive: boolean;
}

interface GarmentGalleryProps {
  garments: Garment[];
  onGarmentToggle: (id: string) => void;
  onGarmentRemove: (id: string) => void;
  onAddMore: () => void;
}

const getGarmentIcon = (type: Garment['type']) => {
  switch (type) {
    case 'tshirt':
      return <Shirt className="h-4 w-4" />;
    case 'footwear':
      return <Footprints className="h-4 w-4" />;
    case 'accessory':
      return <Watch className="h-4 w-4" />;
    case 'dress':
      return <Shirt className="h-4 w-4" />;
  }
};

const getGarmentTypeLabel = (type: Garment['type']) => {
  switch (type) {
    case 'tshirt':
      return 'T-Shirt';
    case 'footwear':
      return 'Footwear';
    case 'accessory':
      return 'Accessory';
    case 'dress':
      return 'Dress';
  }
};

export const GarmentGallery = ({ garments, onGarmentToggle, onGarmentRemove, onAddMore }: GarmentGalleryProps) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | Garment['type']>('all');

  const categories = ['all', 'tshirt', 'footwear', 'accessory', 'dress'] as const;

  const filteredGarments = selectedCategory === 'all'
    ? garments
    : garments.filter(g => g.type === selectedCategory);

  return (
    <Card className="p-6 fashion-card">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Garment Collection</h3>
          <Button variant="fashion" size="sm" onClick={onAddMore}>
            <Plus className="h-4 w-4" />
            Add More
          </Button>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "accent" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="capitalize"
            >
              {category === 'all' ? 'All Items' : getGarmentTypeLabel(category as Garment['type'])}
            </Button>
          ))}
        </div>

        {/* Garments Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredGarments.map((garment) => (
            <div key={garment.id} className="relative group">
              <Card
                className={cn(
                  "overflow-hidden cursor-pointer transition-all fashion-card",
                  garment.isActive && "ring-2 ring-primary shadow-lg"
                )}
                onClick={() => onGarmentToggle(garment.id)}
              >
                <div className="aspect-square relative overflow-hidden">
                  <img
                    src={garment.imageUrl}
                    alt={garment.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  {garment.isActive && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <Badge variant="default" className="bg-primary text-primary-foreground">
                        Active
                      </Badge>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    {getGarmentIcon(garment.type)}
                    <Badge variant="outline" className="text-xs">
                      {getGarmentTypeLabel(garment.type)}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium truncate">{garment.name}</p>
                </div>
              </Card>

              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onGarmentRemove(garment.id);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {filteredGarments.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Shirt className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">
              {selectedCategory === 'all'
                ? "No garments added yet. Upload some items to get started!"
                : `No ${getGarmentTypeLabel(selectedCategory as Garment['type']).toLowerCase()} items found.`
              }
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};