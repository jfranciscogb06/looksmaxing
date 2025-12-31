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
 * Check if face is in correct position and not obstructed
 * Returns: { ready: boolean, message: string, confidence: number }
 */
export async function checkFacePosition(imageBase64, requiredPose = 'center') {
  try {
    const client = getOpenAIClient();
    if (!client) {
      return { 
        ready: false, 
        message: 'AI service unavailable', 
        confidence: 0,
        correctPosition: false
      };
    }

    // Remove data:image prefix if present
    let base64Data = imageBase64;
    if (imageBase64.includes(',')) {
      base64Data = imageBase64.split(',')[1];
    }

    const imageContent = {
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${base64Data}`
      }
    };

    // Map pose names to simple questions (including obstruction and glasses check)
    const poseQuestions = {
      'center': 'Does it look like a user is looking straight ahead at the camera, there are no objects in the way, AND they are NOT wearing glasses?',
      'left': 'Does it look like a user is looking to their left, there are no objects in the way, AND they are NOT wearing glasses?',
      'right': 'Does it look like a user is looking to their right, there are no objects in the way, AND they are NOT wearing glasses?',
      'up': 'Does it look like a user is looking up, there are no objects in the way, AND they are NOT wearing glasses?',
      'down': 'Does it look like a user is looking down, there are no objects in the way, AND they are NOT wearing glasses?'
    };

    const poseQuestion = poseQuestions[requiredPose.toLowerCase()] || poseQuestions['center'];

    const prompt = `${poseQuestion}

Return ONLY a JSON object with this EXACT structure:
{
  "correctPosition": true/false,
  "message": "brief description"
}

RULES:
- correctPosition: true ONLY if ALL of the following are true:
  1. It looks like a user is ${requiredPose === 'center' ? 'looking straight ahead' : requiredPose === 'left' ? 'looking to their left' : requiredPose === 'right' ? 'looking to their right' : requiredPose === 'up' ? 'looking up' : 'looking down'}
  2. There are no objects blocking their face (no hands, objects, or significant obstructions)
  3. The user is NOT wearing glasses (eyeglasses/sunglasses) - glasses obstruct facial analysis and must be removed
  Be lenient on position - if they are approximately in the correct position and clearly visible, return true. But be strict on glasses - if glasses are visible, return false.
- message: Brief explanation like "User is looking ${requiredPose === 'center' ? 'straight ahead' : requiredPose}" or "User is not looking ${requiredPose === 'center' ? 'straight ahead' : requiredPose}" or "No user detected" or "Face is obstructed" or "Please remove glasses for accurate scanning"

Return ONLY the JSON, no other text.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            imageContent
          ]
        }
      ],
      max_tokens: 100,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { 
        ready: false, 
        message: 'No response from AI', 
        confidence: 0,
        correctPosition: false
      };
    }

    try {
      const result = JSON.parse(content);
      const correctPosition = result.correctPosition === true;
      
      return {
        ready: correctPosition,
        message: result.message || (correctPosition ? `User is in correct ${requiredPose} position` : `User is not in correct ${requiredPose} position`),
        confidence: correctPosition ? 90 : 0,
        correctPosition,
      };
    } catch (parseError) {
      console.error('Failed to parse face detection response:', parseError);
      return { 
        ready: false, 
        message: 'Failed to parse response', 
        confidence: 0,
        correctPosition: false
      };
    }
  } catch (error) {
    console.error('Error in checkFacePosition:', error);
    return { 
      ready: false, 
      message: 'Error checking face', 
      confidence: 0,
      correctPosition: false
    };
  }
}

