const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const previewContainer = document.getElementById('previewContainer');
const apiKeyInput = document.getElementById('apiKeyInput');
const promptSelect = document.getElementById('promptSelect');
const analyzeButton = document.getElementById('analyzeButton');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const responseDiv = document.getElementById('response');
const settingsButton = document.getElementById('settingsButton');
const settingsPopup = document.getElementById('settingsPopup');
const saveSettingsButton = document.getElementById('saveSettings');
const closeSettingsButton = document.getElementById('closeSettings');
const additionalContext = document.getElementById('additionalContext');

let selectedFiles = [];

const prompts = {
    simple: "Explain this meme: What's happening in the image? Why is it funny?",
    detailed: "Explain this meme for someone unfamiliar with [American/Western/specific] culture: Break down all the visual elements present. (If there is a sequence or dialogue in the image, write it down in order.) What makes it funny? Any similar memes or trends it relates to? Any cultural references or context?",
    korean: "이 밈을 설명해주세요: 이미지에서 무슨 일이 일어나고 있나요? 왜 재미있는건가요?"
};

const notePrompt = "\nNote 1:  Don't respond with Certainly! or Sure. Just start writing the main text.\nNote 2: Don't use Markdown formatting.\nNote 3: Use a casual and informal tone.";

// Auto-resize textarea
additionalContext.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Load settings from localStorage on page load
document.addEventListener('DOMContentLoaded', () => {
    const savedApiKey = localStorage.getItem('openaiApiKey');
    const savedPromptStyle = localStorage.getItem('promptStyle') || 'simple';
    
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
    }
    
    promptSelect.value = savedPromptStyle;
    updateAnalyzeButton();
});

// Settings popup handlers
settingsButton.addEventListener('click', () => {
    settingsPopup.classList.add('active');
});

closeSettingsButton.addEventListener('click', () => {
    settingsPopup.classList.remove('active');
});

// Save settings and update button state
saveSettingsButton.addEventListener('click', () => {
    localStorage.setItem('openaiApiKey', apiKeyInput.value.trim());
    localStorage.setItem('promptStyle', promptSelect.value);
    settingsPopup.classList.remove('active');
    updateAnalyzeButton();
});

// Close popup when clicking outside
settingsPopup.addEventListener('click', (e) => {
    if (e.target === settingsPopup) {
        settingsPopup.classList.remove('active');
    }
});

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
});

function highlight(e) {
    dropZone.classList.add('dragover');
}

function unhighlight(e) {
    dropZone.classList.remove('dragover');
}

dropZone.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', function() {
    handleFiles(this.files);
});

function handleFiles(files) {
    Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
            selectedFiles.push(file);
            addPreviewImage(file);
        }
    });
    updateAnalyzeButton();
}

function addPreviewImage(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        
        const img = document.createElement('img');
        img.src = e.target.result;
        img.className = 'preview-image';
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-image';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => {
            selectedFiles = selectedFiles.filter(f => f !== file);
            previewContainer.removeChild(previewItem);
            updateAnalyzeButton();
        };
        
        previewItem.appendChild(img);
        previewItem.appendChild(removeBtn);
        previewContainer.appendChild(previewItem);
    }
    reader.readAsDataURL(file);
}

function updateAnalyzeButton() {
    const apiKey = localStorage.getItem('openaiApiKey');
    analyzeButton.disabled = selectedFiles.length === 0 || !apiKey;
}

analyzeButton.addEventListener('click', async () => {
    const apiKey = localStorage.getItem('openaiApiKey');
    if (selectedFiles.length === 0 || !apiKey) return;

    errorDiv.style.display = 'none';
    responseDiv.style.display = 'none';
    loadingDiv.style.display = 'flex';
    analyzeButton.disabled = true;

    try {
        const imageContents = await Promise.all(selectedFiles.map(async file => {
            const base64Image = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(file);
            });
            return {
                type: "image_url",
                image_url: {
                    url: `data:${file.type};base64,${base64Image}`,
                    detail: "high"
                }
            };
        }));

        const contextText = additionalContext.value.trim();
        const selectedPrompt = prompts[promptSelect.value];
        const promptText = selectedPrompt + 
            (contextText ? `\n\nAdditional context provided: ${contextText}` : "") +
            notePrompt;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: promptText
                            },
                            ...imageContents
                        ]
                    }
                ],
                max_tokens: 500
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Failed to analyze images');
        }

        // Parse markdown and set innerHTML safely
        const parsedContent = marked.parse(data.choices[0].message.content);
        responseDiv.innerHTML = DOMPurify.sanitize(parsedContent);
        responseDiv.style.display = 'block';
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
    } finally {
        loadingDiv.style.display = 'none';
        analyzeButton.disabled = false;
    }
});
