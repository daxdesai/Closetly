import { GoogleGenerativeAI } from "@google/generative-ai";

export type SupportedMimeType =
  | "image/png"
  | "image/jpeg"
  | "image/webp";

async function fileToBase64(file: File): Promise<{ base64: string; mimeType: SupportedMimeType }> {
  const mimeType = (file.type as SupportedMimeType) || "image/png";
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return { base64, mimeType };
}

export interface PlacementBox {
  x: number; // 0..1 relative left
  y: number; // 0..1 relative top
  width: number; // 0..1 relative width
  height: number; // 0..1 relative height
  rotationDeg?: number; // optional rotation
}

export async function estimateGarmentPlacement(params: {
  garmentFile: File;
  garmentType: string;
  apiKey?: string;
}): Promise<PlacementBox> {
  const { garmentFile, garmentType, apiKey } = params;
  const key = apiKey || import.meta.env.VITE_GOOGLE_AI_API_KEY;
  if (!key) throw new Error("Missing Google AI API key. Set VITE_GOOGLE_AI_API_KEY.");

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const garment = await fileToBase64(garmentFile);

//   console.log("garmentType", garmentType);
  

  const garmentHints =
    garmentType === "dress"
      ? "The dress should start near the shoulders and extend to the ankles, centered horizontally. Width typically 50-65% of image width, height 75-90% of image height."
      : garmentType === "tshirt"
      ? "Place over torso and shoulders."
      : garmentType === "pants"
      ? "Place from waist to ankles, covering the lower body. Width should match the model's leg width."
      : garmentType === "shorts"
      ? "Place from waist to mid-thigh, covering the upper leg area. Width should match the model's leg width."
      : garmentType === "footwear"
      ? "Place near feet at the bottom."
      : garmentType === "accessory"
      ? "Place near chest/neck depending on accessory."
      : "";
  const prompt = `You are an expert fashion stylist. Analyze this ${garmentType} garment and determine where it should be placed on a standard fashion model. ${garmentHints} Return ONLY strict JSON with keys: x, y, width, height, rotationDeg. All values must be relative in range [0,1] except rotationDeg in degrees. Do not include any text outside the JSON.`;

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { text: `Garment type: ${garmentType}` },
          { inlineData: { data: garment.base64, mimeType: garment.mimeType } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
    },
  });  

  const text = result.response.text();
  try {
    const jsonText = stripCodeFences(text);
    const json = JSON.parse(jsonText);
    let box: PlacementBox = {
      x: clamp01(json.x),
      y: clamp01(json.y),
      width: clamp01(json.width),
      height: clamp01(json.height),
      rotationDeg: typeof json.rotationDeg === "number" ? json.rotationDeg : 0,
    };
    if (!isValidBox(box)) {
      const fallback = getDefaultBox(garmentType);
      console.warn("[try-on] AI returned invalid box; using fallback", { box, fallback, garmentType });
      box = fallback;
    }
    return box;
  } catch (e) {
    const fallback = getDefaultBox(garmentType);
    console.warn("[try-on] Failed to parse AI response; using fallback", { text, garmentType, fallback });
    return fallback;
  }
}

function clamp01(v: number): number {
  if (typeof v !== "number" || Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function isValidBox(box: PlacementBox): boolean {
  const within =
    box.x >= 0 && box.x <= 1 &&
    box.y >= 0 && box.y <= 1 &&
    box.width > 0 && box.width <= 1 &&
    box.height > 0 && box.height <= 1;
  const area = box.width * box.height;
  return within && area >= 0.02; // avoid tiny/degenerate boxes
}

function getDefaultBox(garmentType: string): PlacementBox {
  switch (garmentType) {
    case "dress":
      return { x: 0.225, y: 0.08, width: 0.55, height: 0.82, rotationDeg: 0 };
    case "tshirt":
    case "top":
      return { x: 0.25, y: 0.18, width: 0.5, height: 0.4, rotationDeg: 0 };
    case "pants":
      return { x: 0.25, y: 0.35, width: 0.5, height: 0.45, rotationDeg: 0 };
    case "shorts":
      return { x: 0.25, y: 0.35, width: 0.5, height: 0.25, rotationDeg: 0 };
    case "footwear":
      return { x: 0.35, y: 0.78, width: 0.3, height: 0.18, rotationDeg: 0 };
    case "accessory":
      return { x: 0.4, y: 0.1, width: 0.2, height: 0.2, rotationDeg: 0 };
    default:
      return { x: 0.25, y: 0.2, width: 0.5, height: 0.5, rotationDeg: 0 };
  }
}

function stripCodeFences(text: string): string {
  // Remove ```json ... ``` wrappers if present
  const fence = /```[a-zA-Z]*\n([\s\S]*?)```/m;
  const match = text.match(fence);
  return match ? match[1] : text;
}

export interface GarmentInput {
  url: string;
  type: string;
  file: File;
}

// Function to generate AI try-on using Gemini 2.0 Flash with image generation
async function generateAITryOn(garments: GarmentInput[], apiKey: string, gender: "male" | "female" | "any" = "female"): Promise<string | null> {
  console.log("[try-on] Generating AI try-on with Gemini 2.0 Flash", { garmentCount: garments.length });
  
  // Check if we have too many garments (API might have limits)
  if (garments.length > 5) {
    console.warn(`[try-on] Too many garments (${garments.length}), limiting to first 5 for API compatibility`);
    garments = garments.slice(0, 5);
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Try the new image generation model first
  try {
    const imageModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash-preview-image-generation" });
    
    // Convert all garment files to base64 for the AI
    const garmentData = await Promise.all(
      garments.map(async (g) => {
        const { base64, mimeType } = await fileToBase64(g.file);
        return { base64, mimeType, type: g.type };
      })
    );
    
    // Create a detailed prompt for image generation with garment references
    const garmentDescriptions = garments.map((g, i) => 
      `Garment ${i+1}: ${g.type.charAt(0).toUpperCase() + g.type.slice(1)} (see attached image)`
    ).join("\n");
    
    // Create gender-specific model description
    const modelDescription = gender === "male" 
      ? "Young man model with natural appearance, masculine features"
      : gender === "female"
      ? "Young woman model with natural appearance, feminine features" 
      : "Young adult model with natural appearance, androgynous or gender-neutral features";

    const prompt = `Create a professional fashion model wearing ALL the exact garments shown in the attached images.

IMPORTANT: You will receive ${garmentData.length} garment images. The model MUST wear ALL of them together as a complete outfit.

Garments to be worn: ${garmentDescriptions}

CRITICAL REQUIREMENTS:
- The model MUST wear ALL ${garmentData.length} garments from the attached images simultaneously
- Do NOT miss any garment - every single attached garment must be visible on the model
- Preserve the original colors, patterns, textures, and designs of each garment
- Professional e-commerce product photo style
- ${modelDescription}
- Clean, minimalist background (off-white or light gray)
- Bright, even studio lighting
- Full body shot from head to feet
- Model standing straight, facing camera
- Natural pose with arms relaxed at sides
- High-quality, photorealistic image
- Each garment should fit naturally on the model's body
- Maintain the exact visual characteristics of each uploaded garment
- The final image should show a complete outfit with ALL garments combined

REMINDER: Count the garments - there should be ${garmentData.length} different garments visible on the model.`;

    // Build parts array with text prompt and all garment images
    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: SupportedMimeType } }> = [
      { text: prompt }
    ];
    
    // Add each garment image to the request
    for (let i = 0; i < garmentData.length; i++) {
      parts.push({ text: `Garment ${i+1} (${garments[i].type}):` });
      parts.push({ inlineData: { data: garmentData[i].base64, mimeType: garmentData[i].mimeType } });
      console.log(`[try-on] Added garment ${i+1}/${garmentData.length} to AI request: ${garments[i].type}`);
    }
    
    console.log(`[try-on] Total parts being sent to AI: ${parts.length} (${garmentData.length} garments + text)`);

    const result = await imageModel.generateContent({
      contents: [
        {
          role: "user",
          parts: parts,
        },
      ],
      generationConfig: {
        temperature: 0.3,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        response_modalities: ["TEXT", "IMAGE"], // Required for this model
      } as Record<string, unknown>, // Type assertion to bypass TypeScript limitation
    });
    
    // Extract the image from the response
    const response = result.response;
    console.log("[try-on] AI response received, checking for image...");
    
    // Log the full response structure for debugging
    if (response.candidates?.[0]?.content?.parts) {
      console.log("[try-on] Response parts count:", response.candidates[0].content.parts.length);
      response.candidates[0].content.parts.forEach((part, index) => {
        if (part.text) {
          console.log(`[try-on] Part ${index}: Text (${part.text.length} chars):`, part.text.substring(0, 200) + "...");
        }
        if (part.inlineData) {
          console.log(`[try-on] Part ${index}: Image data (${part.inlineData.mimeType})`);
        }
      });
    }
    
    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      part => part.inlineData?.mimeType?.startsWith("image/")
    );
    
    if (imagePart?.inlineData?.data) {
      console.log("[try-on] Successfully generated AI model wearing uploaded garments with Gemini 2.0 Flash");
      return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    } else {
      console.log("[try-on] Gemini 2.0 Flash did not return an image, checking response...");
      console.log("[try-on] Response parts:", response.candidates?.[0]?.content?.parts?.map(p => ({ 
        hasText: !!p.text, 
        hasInlineData: !!p.inlineData,
        mimeType: p.inlineData?.mimeType 
      })));
    }
  } catch (error) {
    console.warn("[try-on] Gemini 2.0 Flash image generation failed, trying fallback approach:", error);
    
    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('503') || error.message.includes('Service Unavailable')) {
        console.warn("[try-on] Gemini API is currently unavailable (503). Using canvas composition.");
      } else if (error.message.includes('quota') || error.message.includes('429')) {
        console.warn("[try-on] API quota exceeded. Using canvas composition.");
      } else {
        console.warn("[try-on] Unknown API error:", error.message);
      }
    }
    
    // Try a simpler approach with fewer garments if the first attempt failed
    if (garments.length > 2) {
      console.log("[try-on] Trying with fewer garments (first 2) to see if that works better");
      try {
        const limitedGarments = garments.slice(0, 2);
        const limitedGarmentData = await Promise.all(
          limitedGarments.map(async (g) => {
            const { base64, mimeType } = await fileToBase64(g.file);
            return { base64, mimeType, type: g.type };
          })
        );
        
        const simplePrompt = `Create a professional fashion model wearing these 2 garments together as a complete outfit. Make sure both garments are visible on the model.`;
        
        const simpleParts: Array<{ text: string } | { inlineData: { data: string; mimeType: SupportedMimeType } }> = [
          { text: simplePrompt }
        ];
        
        for (let i = 0; i < limitedGarmentData.length; i++) {
          simpleParts.push({ text: `Garment ${i+1}:` });
          simpleParts.push({ inlineData: { data: limitedGarmentData[i].base64, mimeType: limitedGarmentData[i].mimeType } });
        }
        
        const fallbackImageModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash-preview-image-generation" });
        const simpleResult = await fallbackImageModel.generateContent({
          contents: [{ role: "user", parts: simpleParts }],
          generationConfig: {
            temperature: 0.3,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192,
            response_modalities: ["TEXT", "IMAGE"],
          } as Record<string, unknown>,
        });
        
        const simpleImagePart = simpleResult.response.candidates?.[0]?.content?.parts?.find(
          part => part.inlineData?.mimeType?.startsWith("image/")
        );
        
        if (simpleImagePart?.inlineData?.data) {
          console.log("[try-on] Successfully generated image with limited garments approach");
          return `data:${simpleImagePart.inlineData.mimeType};base64,${simpleImagePart.inlineData.data}`;
        }
      } catch (fallbackError) {
        console.warn("[try-on] Fallback approach also failed:", fallbackError);
      }
    }
  }
  
  // Fallback: Try with regular Gemini 1.5 Flash for text-based analysis
  try {
    const textModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Convert all garment files to base64
    const garmentData = await Promise.all(
      garments.map(async (g) => {
        const { base64, mimeType } = await fileToBase64(g.file);
        return { base64, mimeType, type: g.type };
      })
    );
    
    const garmentDescriptions = garments.map((g, i) => 
      `Garment ${i+1}: ${g.type.charAt(0).toUpperCase() + g.type.slice(1)}`
    ).join("\n");
    
    const prompt = `Analyze these fashion garments and provide detailed styling recommendations:

${garmentDescriptions}

Please provide:
1. Color coordination analysis
2. Style compatibility assessment
3. Suggested outfit composition
4. Fashion styling tips

Note: This is for styling analysis only.`;

    // Build parts array explicitly to avoid TypeScript issues
    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: SupportedMimeType } }> = [{ text: prompt }];
    for (let i = 0; i < garmentData.length; i++) {
      parts.push({ text: `Garment ${i+1} (${garments[i].type}):` });
      parts.push({ inlineData: { data: garmentData[i].base64, mimeType: garmentData[i].mimeType } });
    }

    const result = await textModel.generateContent({
      contents: [
        {
          role: "user",
          parts: parts,
        },
      ],
      generationConfig: {
        temperature: 0.3,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 2048,
      },
    });
    
    console.log("[try-on] Gemini 1.5 Flash provided styling analysis:", result.response.text());
    // Return null since this model doesn't generate images
    return null;
    
  } catch (error) {
    console.error("[try-on] Gemini 1.5 Flash analysis failed:", error);
    return null;
  }
}

export async function composeTryOnImage(params: {
  garments: GarmentInput[];
  gender?: "male" | "female" | "any";
}): Promise<string> {
  const { garments, gender = "female" } = params;
  console.log("[try-on] Starting composition with multiple garments", { 
    garmentCount: garments.length, 
    garmentTypes: garments.map(g => g.type),
    gender,
    garmentDetails: garments.map(g => ({
      type: g.type,
      hasUrl: !!g.url,
      hasFile: !!g.file,
      urlLength: g.url?.length || 0
    }))
  });
  
  // Try to use Gemini for AI-generated try-on if we have API key
  const apiKey = import.meta.env.VITE_GOOGLE_AI_API_KEY;
  if (apiKey && garments.length > 0) {
    try {
      console.log("[try-on] Attempting AI generation with Gemini 2.0 Flash...");
      const aiResult = await generateAITryOn(garments, apiKey, gender);
      if (aiResult) {
        console.log("[try-on] Successfully generated AI try-on image");
        return aiResult;
      }
      console.log("[try-on] AI generation returned null, using enhanced canvas composition");
    } catch (e) {
      console.error("[try-on] AI generation failed, falling back to canvas composition", e);
      
      // Check if it's a quota error and provide helpful message
      if (e instanceof Error && e.message.includes('quota')) {
        console.warn("[try-on] API quota exceeded. Using enhanced canvas composition instead.");
      } else if (e instanceof Error && e.message.includes('429')) {
        console.warn("[try-on] Rate limit exceeded. Using enhanced canvas composition instead.");
      } else if (e instanceof Error && e.message.includes('model')) {
        console.warn("[try-on] Model not available. Using enhanced canvas composition instead.");
      }
    }
  } else if (!apiKey) {
    console.log("[try-on] No API key found, using enhanced canvas composition");
  }
  
  // Enhanced canvas-based composition as fallback
  console.log("[try-on] Using enhanced canvas composition for realistic model generation");
  const modelImg = await createStandardModelImage(gender);
  
  // Load garment images with error handling
  const garmentImages: HTMLImageElement[] = [];
  for (let i = 0; i < garments.length; i++) {
    const garment = garments[i];
    try {
      console.log(`[try-on] Loading garment ${i+1}/${garments.length}:`, {
        type: garment.type,
        url: garment.url.substring(0, 50) + "..."
      });
      const img = await loadImage(garment.url);
      garmentImages.push(img);
    } catch (error) {
      console.error(`[try-on] Failed to load garment ${i+1}:`, error);
      // Skip this garment but continue with others
      continue;
    }
  }
  
  if (garmentImages.length === 0) {
    throw new Error("Failed to load any garment images");
  }
  
  console.log(`[try-on] Successfully loaded ${garmentImages.length}/${garments.length} garment images`);

  const canvas = document.createElement("canvas");
  canvas.width = modelImg.width;
  canvas.height = modelImg.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  // Draw the enhanced standard model
  ctx.drawImage(modelImg, 0, 0, canvas.width, canvas.height);

  // Process each garment with improved placement
  for (let i = 0; i < garments.length; i++) {
    const garment = garments[i];
    
    // Skip if this garment image failed to load
    if (i >= garmentImages.length) {
      console.warn(`[try-on] Skipping garment ${i+1} (${garment.type}) - image failed to load`);
      continue;
    }
    
    const garmentImg = garmentImages[i];
    
    console.log(`[try-on] Processing garment ${i+1}/${garments.length} of type: ${garment.type}`);
    
    // Get placement box for the garment based on type
    let box;
    
    // Use specific placement for each garment type with improved positioning
    switch(garment.type) {
      case 'dress':
        box = { x: 0.225, y: 0.08, width: 0.55, height: 0.82, rotationDeg: 0 };
        break;
      case 'tshirt':
      case 'top':
        box = { x: 0.25, y: 0.18, width: 0.5, height: 0.4, rotationDeg: 0 };
        break;
      case 'pants':
        box = { x: 0.25, y: 0.35, width: 0.5, height: 0.45, rotationDeg: 0 };
        break;
      case 'shorts':
        box = { x: 0.25, y: 0.35, width: 0.5, height: 0.25, rotationDeg: 0 };
        break;
      case 'footwear':
        box = { x: 0.35, y: 0.78, width: 0.3, height: 0.18, rotationDeg: 0 };
        break;
      case 'accessory':
        box = { x: 0.4, y: 0.1, width: 0.2, height: 0.2, rotationDeg: 0 };
        break;
      default:
        box = { x: 0.25, y: 0.2, width: 0.5, height: 0.5, rotationDeg: 0 };
    }
    
    const targetW = canvas.width * box.width;
    const targetH = canvas.height * box.height;
    const targetX = canvas.width * box.x;
    const targetY = canvas.height * box.y;

    if (box.rotationDeg && box.rotationDeg !== 0) {
      ctx.save();
      ctx.translate(targetX + targetW / 2, targetY + targetH / 2);
      ctx.rotate((box.rotationDeg * Math.PI) / 180);
      drawGarmentWithBgRemoval(ctx, garmentImg, -targetW / 2, -targetH / 2, targetW, targetH);
      ctx.restore();
    } else {
      drawGarmentWithBgRemoval(ctx, garmentImg, targetX, targetY, targetW, targetH);
    }
  }

  const dataUrl = canvas.toDataURL("image/png");
  console.log("[try-on] Created composed image with multiple garments", {
    width: canvas.width,
    height: canvas.height,
    garmentCount: garments.length
  });
  return dataUrl;
}

function drawGarmentWithBgRemoval(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  // Draw onto an offscreen canvas to apply background removal
  const off = document.createElement("canvas");
  off.width = Math.max(1, Math.floor(w));
  off.height = Math.max(1, Math.floor(h));
  const octx = off.getContext("2d");
  if (!octx) {
    ctx.globalAlpha = 0.95;
    ctx.drawImage(img, x, y, w, h);
    return;
  }
  
  octx.drawImage(img, 0, 0, off.width, off.height);
  const imgData = octx.getImageData(0, 0, off.width, off.height);
  const data = imgData.data;

  // Improved background removal for better garment isolation
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Compute brightness and color characteristics
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    const maxRGB = Math.max(r, g, b);
    const minRGB = Math.min(r, g, b);
    const contrast = maxRGB - minRGB;
    const saturation = contrast / (maxRGB + 0.001);

    // More aggressive background removal
    // Remove white/light backgrounds
    if (brightness > 230 && contrast < 25) {
      data[i + 3] = 0;
    }
    // Remove very light gray backgrounds
    else if (brightness > 210 && contrast < 20 && saturation < 0.15) {
      data[i + 3] = 0;
    }
    // Remove pure white
    else if (r > 245 && g > 245 && b > 245) {
      data[i + 3] = 0;
    }
    // Enhance garment edges with slight transparency reduction
    else {
      // Keep more of the garment visible
      data[i + 3] = Math.min(255, Math.round(a * 0.99));
    }
  }
  
  octx.putImageData(imgData, 0, 0);

  // Add a more pronounced shadow effect for better visibility
  ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;
  
  // Increase opacity for better visibility
  ctx.globalAlpha = 0.98;
  ctx.drawImage(off, x, y, w, h);
  
  // Reset shadow
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}


function createStandardModelImage(gender: "male" | "female" | "any" = "female"): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    // Create a professional studio background with better lighting
    const gradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 3, 0, canvas.width / 2, canvas.height / 2, canvas.width);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.3, "#f8f9fa");
    gradient.addColorStop(0.7, "#e9ecef");
    gradient.addColorStop(1, "#dee2e6");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add subtle floor shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
    ctx.ellipse(canvas.width / 2, canvas.height - 20, 80, 15, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw a realistic human figure with proper anatomy based on gender
    const skinTone = "#f4a261";
    const hairColor = gender === "male" ? "#1a202c" : "#2d3748";
    
    // Reset shadow for body parts
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Head with gender-specific proportions
    ctx.fillStyle = skinTone;
    ctx.beginPath();
    if (gender === "male") {
      // Slightly more angular head for male
      ctx.ellipse(canvas.width / 2, 80, 32, 38, 0, 0, 2 * Math.PI);
    } else if (gender === "female") {
      // More rounded head for female
      ctx.ellipse(canvas.width / 2, 80, 30, 40, 0, 0, 2 * Math.PI);
    } else {
      // Neutral proportions for any gender
      ctx.ellipse(canvas.width / 2, 80, 31, 39, 0, 0, 2 * Math.PI);
    }
    ctx.fill();
    
    // Hair with gender-specific styles
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    if (gender === "male") {
      // Shorter, more masculine hair
      ctx.ellipse(canvas.width / 2, 70, 32, 20, 0, 0, 2 * Math.PI);
    } else if (gender === "female") {
      // Longer, more feminine hair
      ctx.ellipse(canvas.width / 2, 65, 35, 28, 0, 0, 2 * Math.PI);
    } else {
      // Neutral hair length
      ctx.ellipse(canvas.width / 2, 67, 33, 24, 0, 0, 2 * Math.PI);
    }
    ctx.fill();
    
    // Face features (subtle)
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    // Eyes
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2 - 12, 75, 3, 2, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2 + 12, 75, 3, 2, 0, 0, 2 * Math.PI);
    ctx.fill();
    // Nose
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, 85, 2, 3, 0, 0, 2 * Math.PI);
    ctx.fill();
    // Mouth
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, 95, 4, 2, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    // Neck
    ctx.fillStyle = skinTone;
    ctx.fillRect(canvas.width / 2 - 12, 115, 24, 30);
    
    // Shoulders with gender-specific width
    ctx.beginPath();
    if (gender === "male") {
      // Broader shoulders for male
      ctx.moveTo(canvas.width / 2 - 55, 145);
      ctx.lineTo(canvas.width / 2 - 42, 170);
      ctx.lineTo(canvas.width / 2 + 42, 170);
      ctx.lineTo(canvas.width / 2 + 55, 145);
    } else if (gender === "female") {
      // Narrower shoulders for female
      ctx.moveTo(canvas.width / 2 - 48, 145);
      ctx.lineTo(canvas.width / 2 - 38, 170);
      ctx.lineTo(canvas.width / 2 + 38, 170);
      ctx.lineTo(canvas.width / 2 + 48, 145);
    } else {
      // Neutral shoulder width
      ctx.moveTo(canvas.width / 2 - 50, 145);
      ctx.lineTo(canvas.width / 2 - 40, 170);
      ctx.lineTo(canvas.width / 2 + 40, 170);
      ctx.lineTo(canvas.width / 2 + 50, 145);
    }
    ctx.closePath();
    ctx.fill();
    
    // Body with gender-specific torso shape
    ctx.beginPath();
    if (gender === "male") {
      // More rectangular torso for male
      ctx.moveTo(canvas.width / 2 - 42, 170);
      ctx.lineTo(canvas.width / 2 - 38, 330);
      ctx.lineTo(canvas.width / 2 + 38, 330);
      ctx.lineTo(canvas.width / 2 + 42, 170);
    } else if (gender === "female") {
      // More tapered torso for female
      ctx.moveTo(canvas.width / 2 - 40, 170);
      ctx.lineTo(canvas.width / 2 - 32, 330);
      ctx.lineTo(canvas.width / 2 + 32, 330);
      ctx.lineTo(canvas.width / 2 + 40, 170);
    } else {
      // Neutral torso shape
      ctx.moveTo(canvas.width / 2 - 40, 170);
      ctx.lineTo(canvas.width / 2 - 35, 330);
      ctx.lineTo(canvas.width / 2 + 35, 330);
      ctx.lineTo(canvas.width / 2 + 40, 170);
    }
    ctx.closePath();
    ctx.fill();
    
    // Arms with better positioning
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2 - 60, 220, 18, 100, -0.15, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2 + 60, 220, 18, 100, 0.15, 0, 2 * Math.PI);
    ctx.fill();
    
    // Hands
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2 - 60, 320, 10, 15, -0.15, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2 + 60, 320, 10, 15, 0.15, 0, 2 * Math.PI);
    ctx.fill();
    
    // Legs with natural shape
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2 - 20, 450, 20, 130, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2 + 20, 450, 20, 130, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    // Feet
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2 - 20, 580, 15, 10, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2 + 20, 580, 15, 10, 0, 0, 2 * Math.PI);
    ctx.fill();

    // Add subtle body shadow for depth
    ctx.shadowColor = "rgba(0, 0, 0, 0.08)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 3;

    const img = new Image();
    img.onload = () => resolve(img);
    img.src = canvas.toDataURL();
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    console.log("[try-on] Loading image:", { src: src.substring(0, 50) + "..." });
    
    img.onload = () => {
      console.log("[try-on] Image loaded successfully", {
        src: src.substring(0, 50) + "...",
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
      resolve(img);
    };
    
    img.onerror = (error) => {
      console.error("[try-on] Image loading failed:", {
        src: src.substring(0, 50) + "...",
        error: error
      });
      reject(new Error(`Failed to load image: ${src.substring(0, 50)}...`));
    };
    
    img.src = src;
  });
}


