import OpenAI from 'openai';

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
 * Generate daily prescriptions based on scan metrics
 */
export async function generatePrescriptions(metrics) {
  const prompt = `You are a facial biometric optimization expert. Based on these facial scan metrics, provide specific daily prescriptions:

Water Retention: ${metrics.water_retention}%
Inflammation Index: ${metrics.inflammation_index}
Lymph Congestion Score: ${metrics.lymph_congestion_score}
Facial Fat Layer: ${metrics.facial_fat_layer}%
Definition Score: ${metrics.definition_score}
Potential Ceiling: ${metrics.potential_ceiling}%

Provide a JSON response with these exact fields:
{
  "potassium_target": number in mg,
  "sodium_limit": number in mg,
  "water_timing": "specific timing instructions",
  "magnesium_bedtime_dose": number in mg,
  "carb_type_recommendation": "specific recommendation",
  "step_count_goal": number,
  "recommendations": "brief summary of key actions"
}

Be specific and actionable. Focus on reducing water retention, inflammation, and lymph congestion while improving definition.`;

  try {
    const client = getOpenAIClient();
    if (!client) {
      return getDefaultPrescriptions(metrics);
    }
    
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a facial biometric optimization expert. Always respond with valid JSON only, no additional text.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0].message.content;
    return JSON.parse(response);
  } catch (error) {
    console.error('OpenAI API error:', error);
    // Return default prescriptions if API fails
    return getDefaultPrescriptions(metrics);
  }
}

/**
 * Generate face workout recommendations
 */
export async function generateWorkouts(metrics) {
  const prompt = `Based on these facial metrics, recommend specific face workouts:

Water Retention: ${metrics.water_retention}%
Inflammation Index: ${metrics.inflammation_index}
Lymph Congestion Score: ${metrics.lymph_congestion_score}
Definition Score: ${metrics.definition_score}

Provide a JSON array of workouts with this structure:
{
  "workouts": [
    {
      "name": "workout name",
      "type": "lymph_drainage|neck_posture|blood_flow|inflammation_flush|eye_depuff|jaw_release",
      "duration": number in minutes,
      "instructions": "step-by-step instructions",
      "priority": "high|medium|low"
    }
  ]
}

Focus on workouts that address the highest priority issues.`;

  try {
    const client = getOpenAIClient();
    if (!client) {
      return { workouts: [] };
    }
    
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a facial exercise expert. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0].message.content;
    return JSON.parse(response);
  } catch (error) {
    console.error('OpenAI API error:', error);
    return { workouts: [] };
  }
}

/**
 * Generate insights and analysis from trends
 */
export async function generateInsights(scans) {
  if (scans.length < 2) {
    return { insights: 'Need at least 2 scans to generate insights.' };
  }

  const latest = scans[0];
  const previous = scans[1];

  const changes = {
    water_retention: latest.water_retention - previous.water_retention,
    inflammation_index: latest.inflammation_index - previous.inflammation_index,
    definition_score: latest.definition_score - previous.definition_score,
  };

  const prompt = `Analyze these facial biometric changes over time:

Water Retention: ${changes.water_retention > 0 ? '+' : ''}${changes.water_retention.toFixed(1)}%
Inflammation Index: ${changes.inflammation_index > 0 ? '+' : ''}${changes.inflammation_index.toFixed(1)}
Definition Score: ${changes.definition_score > 0 ? '+' : ''}${changes.definition_score.toFixed(1)}

Current metrics:
- Water Retention: ${latest.water_retention}%
- Inflammation: ${latest.inflammation_index}
- Definition: ${latest.definition_score}
- Potential Ceiling: ${latest.potential_ceiling}%

Provide insights in JSON format:
{
  "trend_analysis": "overall trend description",
  "key_improvements": ["improvement 1", "improvement 2"],
  "areas_of_concern": ["concern 1", "concern 2"],
  "recommendations": ["recommendation 1", "recommendation 2"]
}`;

  try {
    const client = getOpenAIClient();
    if (!client) {
      return { insights: 'OpenAI API key not configured. Unable to generate insights.' };
    }
    
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a facial biometric analyst. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const response = completion.choices[0].message.content;
    return JSON.parse(response);
  } catch (error) {
    console.error('OpenAI API error:', error);
    return { insights: 'Unable to generate insights at this time.' };
  }
}

function getDefaultPrescriptions(metrics) {
  // Fallback prescriptions if API fails
  return {
    potassium_target: 3500,
    sodium_limit: 2000,
    water_timing: 'Drink 16oz upon waking, 8oz every 2 hours, stop 2 hours before bed',
    magnesium_bedtime_dose: 400,
    carb_type_recommendation: 'Focus on low-glycemic carbs like sweet potato, quinoa',
    step_count_goal: 10000,
    recommendations: 'Maintain consistent hydration and reduce sodium intake',
  };
}

