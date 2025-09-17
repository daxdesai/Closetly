import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { User, Users } from "lucide-react";

export type Gender = "male" | "female" | "any";

interface GenderSelectorProps {
    selectedGender: Gender;
    onGenderChange: (gender: Gender) => void;
    className?: string;
}

export const GenderSelector = ({ selectedGender, onGenderChange, className }: GenderSelectorProps) => {
    const genders: { value: Gender; label: string; icon: React.ReactNode; description: string }[] = [
        {
            value: "female",
            label: "Female Model",
            icon: <User className="h-5 w-5" />,
            description: "Generate a female model wearing your garments"
        },
        {
            value: "male",
            label: "Male Model",
            icon: <User className="h-5 w-5" />,
            description: "Generate a male model wearing your garments"
        },
        {
            value: "any",
            label: "Any Gender",
            icon: <Users className="h-5 w-5" />,
            description: "Let AI choose the best model for your garments"
        }
    ];

    return (
        <Card className={`p-4 fashion-card ${className}`}>
            <h3 className="text-lg font-semibold mb-3">Model Gender</h3>
            <p className="text-sm text-muted-foreground mb-4">
                Choose the gender of the model for your virtual try-on
            </p>

            <div className="grid grid-cols-1 gap-2">
                {genders.map((gender) => (
                    <Button
                        key={gender.value}
                        variant={selectedGender === gender.value ? "default" : "outline"}
                        className={`w-full justify-start h-auto p-3 ${selectedGender === gender.value
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted"
                            }`}
                        onClick={() => onGenderChange(gender.value)}
                    >
                        <div className="flex items-center gap-3">
                            {gender.icon}
                            <div className="text-left">
                                <div className="font-medium">{gender.label}</div>
                                <div className="text-xs opacity-80">{gender.description}</div>
                            </div>
                        </div>
                    </Button>
                ))}
            </div>
        </Card>
    );
};
