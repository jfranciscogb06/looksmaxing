import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

let openai = null;

function getOpenAIClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

/**
 * Analyze facial structure using ChatGPT Vision API
 * Takes base64 images and returns metrics based on pseudocode analysis
 */
export async function analyzeFacialStructure(images) {
  try {
    if (!images || !Array.isArray(images) || images.length === 0) {
      console.warn('No images provided, using defaults');
      return getDefaultMetrics();
    }

    const client = getOpenAIClient();
    if (!client) {
      console.error('OpenAI client not available');
      return getDefaultMetrics();
    }

    console.log(`Analyzing ${images.length} image(s) with ChatGPT Vision...`);

    // Prepare images for vision API (remove data:image prefix if present, keep base64)
    const imageContents = images.map((img, index) => {
      try {
        // Remove data:image/jpeg;base64, or similar prefix if present
        let base64Data = img;
        if (img.includes(',')) {
          base64Data = img.split(',')[1];
        }
        
        // Validate base64 data
        if (!base64Data || base64Data.length < 100) {
          console.error(`Invalid base64 data for image ${index}:`, {
            length: base64Data?.length,
            preview: base64Data?.substring(0, 50)
          });
          throw new Error(`Invalid base64 data for image ${index}`);
        }
        
        return {
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${base64Data}`
          }
        };
      } catch (error) {
        console.error(`Error processing image ${index}:`, error);
        throw error;
      }
    });

    // Standardized instructions for consistent AI analysis
    // Map image indices to poses for clarity
    const imagePoses = [
      'center (forward-facing)',
      'looking left (left profile)',
      'looking right (right profile)', 
      'looking up (upward angle)',
      'looking down (downward angle)',
      'center again (forward-facing)'
    ];
    
    const imageDescriptions = images.map((img, idx) => {
      if (idx < imagePoses.length) {
        return `Image ${idx + 1}: ${imagePoses[idx]}`;
      }
      return `Image ${idx + 1}: additional angle`;
    }).join('\n');

    const prompt = `You are a facial biometric analyst. You have been provided with ${images.length} image(s) showing the face from different angles:
${imageDescriptions}

CRITICAL INSTRUCTIONS FOR CONSISTENCY:
1. You must analyze ALL provided images to assess each metric accurately
2. Different metrics require different angles for accurate assessment
3. You must assign DIFFERENT values to each metric - they measure distinct aspects
4. Use the most relevant angle(s) for each specific metric
5. **CRITICAL FOR CONSISTENCY**: Use the scoring anchors below as EXACT reference points. Similar-looking faces should receive similar scores. When assessing visual features, match them precisely to the anchor descriptions and assign scores accordingly. Be consistent - if you see the same visual characteristics, assign the same score.

Return ONLY a valid JSON object with these exact keys:
{
  "water_retention": <number 0-100>,
  "inflammation_index": <number 0-100>,
  "lymph_congestion_score": <number 0-100>,
  "facial_fat_layer": <number 0-100>,
  "definition_score": <number 0-100>,
  "potential_ceiling": 0
}

STANDARDIZED SCORING GUIDELINES - Use these visual anchors:

1. WATER RETENTION % (0-100, lower is better):
   Use CENTER (forward-facing) images primarily, but also check SIDE PROFILES and UPWARD angle.
   Assess overall facial puffiness from:
   - Under-eye bags (best seen in center and up angles)
   - Cheek fullness (visible in center and side profiles)
   - Jaw softness (compare center vs side profiles)
   - Neck pooling (best visible from up angle and side profiles)
   
   SCORING ANCHORS (use these as reference points):
   - 15%: Very lean, sharp jaw from all angles, minimal under-eye bags in center/up, no pooling in sides/up
   - 30%: Normal lean, visible jaw definition from sides, slight under-eye softness, minimal pooling
   - 45%: Moderate puffiness, soft jaw visible from sides, noticeable under-eye bags, some pooling
   - 60%: Significant puffiness, blurred jaw from profiles, prominent bags, visible pooling
   - 75%: Very puffy, minimal jaw definition from sides, heavy bags, significant pooling from up angle

2. INFLAMMATION INDEX / PUFFINESS INDEX (0-100, lower is better):
   Use CENTER, SIDE PROFILES, and UP angles to assess facial inflammation/swelling.
   Look for:
   - Cheek puffiness (visible in center and side profiles - compare fullness)
   - Jaw softness (compare center vs side profiles - should be consistent)
   - Eye area reduction (center and up angles - are eyes narrowed/puffy?)
   - Face shape deviation (does face look rounder/bloated in center vs lean in profiles?)
   
   SCORING ANCHORS:
   - 18%: Very lean from all angles, sharp jaw in profiles, clean neck line, eyes fully open
   - 35%: Normal from all angles, defined jaw in profiles, slight softness
   - 50%: Moderate puffiness visible in center and sides, soft jaw, some eye reduction
   - 65%: Significant puffiness, blurred jaw from profiles, noticeable face rounding
   - 80%: Very puffy from all angles, minimal jaw definition, heavy swelling

3. LYMPH CONGESTION SCORE (0-100, lower is better):
   CRITICAL: Use the LEFT PROFILE (looking left), RIGHT PROFILE (looking right), and UPWARD ANGLE (looking up) images to assess this.
   Lymph congestion is best visible from side and upward angles where you can see:
   - Jaw definition quality (sharp vs soft/blurred)
   - Submental pooling (area under chin/jaw)
   - Lower face heaviness (drooping or pooling in lower face)
   - Neck/jaw junction clarity
   
   SCORING ANCHORS:
   - 15%: Excellent drainage, razor-sharp jaw from side, no pooling under chin, clean neck line from up angle
   - 30%: Good drainage, defined jaw from side profiles, minimal pooling
   - 50%: Moderate congestion, soft jaw visible from sides, noticeable pooling under chin
   - 70%: Poor drainage, blurred jaw from side angles, significant pooling visible from up angle
   - 85%: Severe congestion, minimal jaw definition from profiles, heavy pooling under chin visible from up angle

4. FACIAL FAT LAYER % (0-100, lower is better):
   Use CENTER and SIDE PROFILES to assess facial adiposity.
   Compare:
   - Cheek fullness (center view - are cheeks full or lean?)
   - Face shape (center vs side profiles - angular/defined or round/full?)
   - Bone structure visibility (cheekbones, jawline - best seen in side profiles and center)
   
   SCORING ANCHORS:
   - 12%: Extremely lean, bones highly visible from center and sides, angular face shape
   - 25%: Very lean, bones clearly visible from profiles, defined structure
   - 40%: Normal, bones partially visible, balanced fullness
   - 60%: Full cheeks in center, bones minimally visible from sides, rounded shape
   - 80%: Very full, bones not visible from profiles, round face shape

5. DEFINITION SCORE (0-100, higher is better):
   Use ALL ANGLES to assess facial definition comprehensively.
   Evaluate from:
   - CENTER: Overall structure clarity, cheekbone prominence, face shape definition
   - SIDE PROFILES (left/right): Jaw sharpness, bone structure visibility, profile definition
   - UP ANGLE: Jaw line clarity, neck definition, lower face structure
   - DOWN ANGLE: Overall structure maintenance
   
   SCORING ANCHORS:
   - 80%: Exceptional definition from all angles, razor-sharp jaw in profiles, prominent cheekbones, clear structure
   - 65%: Excellent definition, sharp jaw visible in side profiles, clearly visible cheekbones from center
   - 50%: Good definition, defined jaw from sides, moderate cheekbone visibility
   - 35%: Moderate definition, soft jaw from profiles, subtle cheekbones
   - 20%: Poor definition, blurred jaw from all angles, no visible bone structure

METRIC RELATIONSHIPS (these should correlate logically):
- water_retention and inflammation_index typically move together (±5-10 points)
- lymph_congestion_score correlates with water_retention (±8-15 points)
- definition_score is INVERSE of water_retention/inflammation (when water is high, definition is low)
- facial_fat_layer is independent but often correlates with definition

ANALYSIS PROCESS (FOLLOW STRICTLY FOR CONSISTENCY):
1. Review ALL images to understand the face from multiple angles
2. For LYMPH CONGESTION: Pay special attention to LEFT PROFILE, RIGHT PROFILE, and UPWARD angle images
3. For each metric, use the most relevant angle(s):
   - Water retention: Center + Up + Side profiles
   - Inflammation: Center + Side profiles + Up
   - Lymph congestion: LEFT PROFILE + RIGHT PROFILE + UP ANGLE (critical!)
   - Facial fat: Center + Side profiles
   - Definition: ALL ANGLES (comprehensive view)
4. **MATCH VISUAL FEATURES TO ANCHORS**: Compare what you see in the images to the anchor descriptions. Find the anchor that best matches the visual characteristics you observe. Assign scores that align closely with those anchor points.
5. **CONSISTENCY CHECK**: If the face looks similar to a previous analysis (similar jaw definition, similar under-eye bags, similar cheek fullness), assign similar scores. Consistency across similar faces is more important than precision to a specific number.
6. Ensure logical relationships between metrics (as described in METRIC RELATIONSHIPS)
7. Final check: Metrics must be DIFFERENT (spread of at least 10 points between min and max)

REMEMBER: You have multiple angles for a reason - use them! Especially for lymph congestion, the side and up profiles are essential. MOST IMPORTANTLY: Be consistent - similar visual features should receive similar scores.

Return ONLY the JSON object. Ensure values are distinct and logically consistent.`;

    let response;
    try {
      console.log('Calling OpenAI Vision API with', imageContents.length, 'image(s)...');
      response = await client.chat.completions.create({
        model: 'gpt-5', // GPT-5 for enhanced facial analysis
        messages: [
          {
            role: 'system',
            content: 'You are a consistent facial biometric analyst. Your primary goal is CONSISTENCY - similar-looking faces must receive similar scores. Match visual features to the provided scoring anchors exactly. Assign precise numeric scores (0-100) based on visual assessment, using the anchors as strict reference points. Each metric must have a different value. When in doubt, choose the anchor point that best matches what you see.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              ...imageContents
            ]
          }
        ],
        max_completion_tokens: 2000, // Balanced limit for thorough but faster analysis
        reasoning_effort: 'medium', // Medium reasoning effort for balance between speed and accuracy
        response_format: { type: 'json_object' }
        // Note: GPT-5 only supports default temperature (1), so we don't set it
      });
      console.log('OpenAI API call successful');
    } catch (apiError) {
      console.error('OpenAI API error:', apiError);
      console.error('Error details:', {
        message: apiError.message,
        status: apiError.status,
        code: apiError.code,
        type: apiError.type
      });
      throw new Error(`OpenAI API error: ${apiError.message}`);
    }

    // GPT-5 with reasoning might return content as an array or in different structure
    const message = response.choices[0]?.message;
    let content = message?.content;
    
    // Handle content that might be an array (reasoning models sometimes return array)
    if (Array.isArray(content)) {
      console.log('Content is an array, extracting text:', content);
      // Find the text content (usually the last item or item with type 'text')
      const textContent = content.find(item => item.type === 'text') || content[content.length - 1];
      content = typeof textContent === 'string' ? textContent : textContent?.text || textContent?.content || '';
    }
    
    // If still no content, check for reasoning content or other fields
    if (!content && message) {
      console.warn('No content in message, checking response structure:', {
        hasMessage: !!message,
        messageKeys: Object.keys(message || {}),
        responseKeys: Object.keys(response || {}),
        choicesLength: response.choices?.length,
        messageContent: message?.content,
        messageContentType: typeof message?.content
      });
      
      // Try alternative field names
      if (message.text) content = message.text;
      if (message.output) content = message.output;
    }
    
    if (!content) {
      console.error('No response content from OpenAI');
      console.error('Full response structure:', JSON.stringify(response, null, 2));
      return getDefaultMetrics();
    }

    console.log('OpenAI Vision response:', typeof content === 'string' ? content.substring(0, 500) : content); // Log first 500 chars

    // Parse JSON response
    let metrics;
    try {
      metrics = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      console.error('Response content:', content);
      return getDefaultMetrics();
    }

    // Validate and normalize metrics
    let validatedMetrics = {
      water_retention: validateMetric(metrics.water_retention, 'water_retention'),
      inflammation_index: validateMetric(metrics.inflammation_index, 'inflammation_index'),
      lymph_congestion_score: validateMetric(metrics.lymph_congestion_score, 'lymph_congestion_score'),
      facial_fat_layer: validateMetric(metrics.facial_fat_layer, 'facial_fat_layer'),
      definition_score: validateMetric(metrics.definition_score, 'definition_score'),
      potential_ceiling: 0, // Always 0
    };

    // Validate metric spread (ensure they're not all the same)
    const values = [
      validatedMetrics.water_retention,
      validatedMetrics.inflammation_index,
      validatedMetrics.lymph_congestion_score,
      validatedMetrics.facial_fat_layer,
      validatedMetrics.definition_score
    ];
    
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const spread = maxValue - minValue;
    
    // If metrics are too similar (spread < 10), log a warning but don't add random noise
    // Lower temperature should prevent this, but we log it for monitoring
    if (spread < 10) {
      console.warn('⚠️ AI returned metrics with low spread (', spread, 'points). This may indicate inconsistent analysis.');
      console.warn('Metrics:', validatedMetrics);
    }

    console.log('Final validated metrics from AI:', validatedMetrics);

    return validatedMetrics;
  } catch (error) {
    console.error('Error in analyzeFacialStructure:', error);
    console.error('Error stack:', error.stack);
    return getDefaultMetrics();
  }
}

function validateMetric(value, name) {
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    console.warn(`Invalid ${name}, using default:`, value);
    return getDefaultMetrics()[name] || 25;
  }
  // Clamp to 0-100
  return Math.max(0, Math.min(100, parseFloat(value.toFixed(2))));
}

function getDefaultMetrics() {
  return {
    water_retention: 25.0,
    inflammation_index: 25.0,
    lymph_congestion_score: 25.0,
    facial_fat_layer: 25.0,
    definition_score: 50.0,
    potential_ceiling: 0.0,
  };
}
