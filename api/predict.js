export default async function handler(req, res) {
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
        const endpointBase = process.env.ROBOFLOW_ENDPOINT || 'https://serverless.roboflow.com/garbage-classification-4vzo9/1';

        // If ROBOFLOW_API_KEY is not configured, fall back to test mode
        if (!apiKey) {
            console.warn('ROBOFLOW_API_KEY 환경변수가 설정되지 않아 테스트 모드로 동작합니다.');
            await new Promise(resolve => setTimeout(resolve, 800));

            const mockClasses = ['paper', 'plastic', 'glass', 'metal', 'cardboard', 'trash'];
            const randomClass = mockClasses[Math.floor(Math.random() * mockClasses.length)];
            const randomConfidence = Number((0.78 + Math.random() * 0.20).toFixed(2));

            return res.status(200).json({
                isTestMode: true,
                prediction: {
                    class: randomClass,
                    confidence: randomConfidence
                }
            });
        }

        // Clean base64 string
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

        // Construct Roboflow Serverless Cloud API endpoint with API key
        const roboflowUrl = `${endpointBase}?api_key=${apiKey}`;

        // Send request to Roboflow Serverless API using application/x-www-form-urlencoded
        const roboflowResponse = await fetch(roboflowUrl, {
            method: 'POST',
            body: base64Data,
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
        console.log('Roboflow raw response:', JSON.stringify(result));

        let topPrediction = { class: 'trash', confidence: 0.5 };

        // Handle Roboflow classification & object detection responses
        if (result.class) {
            topPrediction = {
                class: result.class,
                confidence: result.confidence || 0.8
            };
        } else if (result.predictions && result.predictions.length > 0) {
            const sorted = [...result.predictions].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
            topPrediction = {
                class: sorted[0].class || sorted[0].predicted_class || 'trash',
                confidence: sorted[0].confidence || 0.8
            };
        } else if (result.top) {
            topPrediction = {
                class: result.top,
                confidence: result.confidence || 0.8
            };
        } else if (result.predicted_classes && result.predicted_classes.length > 0) {
            topPrediction = {
                class: result.predicted_classes[0],
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
