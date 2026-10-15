/**
 * STREAMING_CHUNK:Initializing serverless function handler...
 * Vercel Serverless Function: /api/predict
 * Receives base64 image data, securely sends it to Roboflow API using ROBOFLOW_API_KEY environment variable.
 * Model: garbage-classification-4vzo9 / version 1
 */

export default async function handler(req, res) {
    // Allow POST requests only
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const { image } = req.body || {};

        if (!image) {
            return res.status(400).json({ error: '이미지 데이터가 전송되지 않았습니다.' });
        }

        const apiKey = process.env.ROBOFLOW_API_KEY;

        // If ROBOFLOW_API_KEY is not configured, fall back to test mode with mock predictions
        if (!apiKey) {
            console.warn('ROBOFLOW_API_KEY 환경변수가 설정되지 않아 테스트 모드로 동작합니다.');
            
            // Simulate processing delay
            await new Promise(resolve => setTimeout(resolve, 800));

            const mockClasses = ['paper', 'plastic', 'glass', 'metal', 'cardboard', 'trash'];
            const randomClass = mockClasses[Math.floor(Math.random() * mockClasses.length)];
            const randomConfidence = Number((0.75 + Math.random() * 0.23).toFixed(2));

            return res.status(200).json({
                isTestMode: true,
                prediction: {
                    class: randomClass,
                    confidence: randomConfidence
                }
            });
        }

        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const modelId = 'garbage-classification-4vzo9';
        const version = '1';
        const roboflowUrl = `https://detect.roboflow.com/${modelId}/${version}?api_key=${apiKey}`;

        // Send request to Roboflow
        const roboflowResponse = await fetch(roboflowUrl, {
            method: 'POST',
            body: buffer,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (!roboflowResponse.ok) {
            const errorText = await roboflowResponse.text();
            console.error('Roboflow API Error:', errorText);
            return res.status(502).json({ error: 'Roboflow AI 서버와 통신 중 오류가 발생했습니다.' });
        }

        const result = await roboflowResponse.json();

        let topPrediction = { class: 'trash', confidence: 0.5 };

        if (result.predictions && result.predictions.length > 0) {
            const sorted = result.predictions.sort((a, b) => b.confidence - a.confidence);
            topPrediction = {
                class: sorted[0].class,
                confidence: sorted[0].confidence
            };
        } else if (result.top) {
            topPrediction = {
                class: result.top,
                confidence: result.confidence || 0.8
            };
        }

        return res.status(200).json({
            isTestMode: false,
            prediction: topPrediction
        });

    } catch (err) {
        console.error('Server prediction error:', err);
        return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
    }
}