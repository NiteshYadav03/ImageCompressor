// script.js
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const qualitySlider = document.getElementById('quality-slider');
    const qualityValue = document.getElementById('quality-value');
    const maxWidthInput = document.getElementById('max-width');
    const imageList = document.getElementById('image-list');
    const compressBtn = document.getElementById('compress-btn');
    const downloadAllBtn = document.getElementById('download-all-btn');
    const resultsContainer = document.getElementById('results');
    
    // State
    let images = [];
    let compressedImages = [];
    
    // Event Listeners
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    dropArea.addEventListener('drop', handleDrop, false);
    fileInput.addEventListener('change', handleFiles);
    qualitySlider.addEventListener('input', updateQualityValue);
    compressBtn.addEventListener('click', compressAllImages);
    downloadAllBtn.addEventListener('click', downloadAllImages);
    
    // Functions
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight() {
        dropArea.classList.add('highlight');
    }
    
    function unhighlight() {
        dropArea.classList.remove('highlight');
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles({ target: { files } });
    }
    
    function handleFiles(e) {
        const fileList = e.target.files;
        if (fileList.length > 0) {
            processFiles(fileList);
        }
    }
    
    function updateQualityValue() {
        qualityValue.textContent = `${qualitySlider.value}%`;
    }
    
    function processFiles(fileList) {
        Array.from(fileList).forEach(file => {
            if (!file.type.match('image.*')) {
                alert('Only image files are supported!');
                return;
            }
            
            // Store the actual file for better compression
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const image = {
                    id: Date.now() + Math.random().toString(36).substr(2, 5),
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    dataUrl: e.target.result,
                    file: file // Keep the original file
                };
                
                images.push(image);
                updateImageList();
                updateButtons();
            };
            
            reader.readAsDataURL(file);
        });
    }
    
    function updateImageList() {
        imageList.innerHTML = '';
        
        images.forEach(image => {
            const imageItem = document.createElement('div');
            imageItem.className = 'image-item';
            imageItem.innerHTML = `
                <img src="${image.dataUrl}" alt="${image.name}" class="image-preview">
                <div class="image-details">
                    <div class="image-name">${image.name}</div>
                    <div class="image-size">${formatSize(image.size)}</div>
                </div>
                <div class="image-actions">
                    <button type="button" class="remove-btn" data-id="${image.id}">
                        <span>🗑️</span>
                    </button>
                </div>
            `;
            
            imageList.appendChild(imageItem);
            
            // Add event listener to remove button
            imageItem.querySelector('.remove-btn').addEventListener('click', () => {
                removeImage(image.id);
            });
        });
    }
    
    function removeImage(id) {
        images = images.filter(image => image.id !== id);
        updateImageList();
        updateButtons();
    }
    
    function updateButtons() {
        compressBtn.disabled = images.length === 0;
        downloadAllBtn.disabled = compressedImages.length === 0;
    }
    
    function compressAllImages() {
        resultsContainer.innerHTML = '';
        compressedImages = [];
        
        const quality = parseInt(qualitySlider.value) / 100;
        const maxWidth = parseInt(maxWidthInput.value);
        
        const promises = images.map(image => compressImage(image, quality, maxWidth));
        
        Promise.all(promises)
            .then(() => {
                updateButtons();
            })
            .catch(error => {
                console.error('Error compressing images:', error);
                alert('An error occurred while compressing the images.');
            });
    }
    
    function compressImage(image, quality, maxWidth) {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = image.dataUrl;
            
            img.onload = function() {
                // Calculate new dimensions while maintaining aspect ratio
                let width = img.width;
                let height = img.height;
                
                // Only resize if the original image is larger than maxWidth
                let resized = false;
                if (width > maxWidth) {
                    height = Math.round(height * (maxWidth / width));
                    width = maxWidth;
                    resized = true;
                }
                
                // Create canvas
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                
                // Draw image on canvas
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Get compressed data URL based on image type
                let mimeType = image.type || 'image/jpeg';
                let compressedDataUrl;
                
                if (mimeType === 'image/png') {
                    // For PNG, try different compression methods
                    if (hasTransparency(ctx, width, height)) {
                        // If image has transparency, we need to keep PNG format
                        compressedDataUrl = canvas.toDataURL('image/png', quality);
                    } else {
                        // If no transparency, convert to JPEG for better compression
                        compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                        mimeType = 'image/jpeg';
                    }
                } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
                    // For JPEG, use the quality parameter
                    compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                } else if (mimeType === 'image/webp') {
                    // For WebP, use the quality parameter
                    compressedDataUrl = canvas.toDataURL('image/webp', quality);
                } else {
                    // For other formats, convert to JPEG
                    compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                    mimeType = 'image/jpeg';
                }
                
                // Calculate compressed size (base64 to binary size)
                const base64 = compressedDataUrl.split(',')[1];
                const compressedSize = Math.round((base64.length * 3) / 4 - 
                    (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0));
                
                // Compare sizes and only use compressed version if it's actually smaller
                if (compressedSize >= image.size && !resized) {
                    // If compression didn't help and we didn't resize, use original
                    const compressedImage = {
                        id: image.id,
                        name: image.name,
                        originalSize: image.size,
                        compressedSize: image.size,
                        originalDataUrl: image.dataUrl,
                        compressedDataUrl: image.dataUrl, // Use original
                        width: img.width,
                        height: img.height,
                        quality: 1,
                        mimeType: image.type,
                        noCompression: true
                    };
                    
                    compressedImages.push(compressedImage);
                    addResultItem(compressedImage);
                } else {
                    // Use compressed version
                    const compressedImage = {
                        id: image.id,
                        name: image.name,
                        originalSize: image.size,
                        compressedSize: compressedSize,
                        originalDataUrl: image.dataUrl,
                        compressedDataUrl: compressedDataUrl,
                        width: width,
                        height: height,
                        quality: quality,
                        mimeType: mimeType
                    };
                    
                    compressedImages.push(compressedImage);
                    addResultItem(compressedImage);
                }
                
                resolve();
            };
        });
    }
    
    // Helper function to check if an image has transparency
    function hasTransparency(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height).data;
        for (let i = 3; i < imageData.length; i += 4) {
            if (imageData[i] < 255) {
                return true; // Has transparent pixels
            }
        }
        return false;
    }
    
    function addResultItem(compressedImage) {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        
        let savingsPercent = Math.round((1 - (compressedImage.compressedSize / compressedImage.originalSize)) * 100);
        
        // Formatting for special cases
        let savingsText;
        if (compressedImage.noCompression) {
            savingsText = 'No compression applied (original was already optimized)';
        } else if (savingsPercent <= 0) {
            savingsText = `Size remained the same but dimensions were adjusted to ${compressedImage.width}x${compressedImage.height}px`;
        } else {
            savingsText = `Saved ${savingsPercent}% of original size`;
        }
        
        resultItem.innerHTML = `
            <img src="${compressedImage.compressedDataUrl}" alt="${compressedImage.name}" class="result-image">
            <div class="result-details">
                <h3>${compressedImage.name}</h3>
                <div class="size-comparison">
                    <span class="original-size">Original: ${formatSize(compressedImage.originalSize)}</span>
                    <span class="compressed-size">Compressed: ${formatSize(compressedImage.compressedSize)}</span>
                </div>
                <div class="dimensions">Dimensions: ${compressedImage.width}x${compressedImage.height}px</div>
                <div class="savings">${savingsText}</div>
            </div>
            <div class="result-actions">
                <a href="${compressedImage.compressedDataUrl}" 
                   download="${getCompressedFileName(compressedImage.name)}" 
                   class="download-btn">Download</a>
            </div>
        `;
        
        resultsContainer.appendChild(resultItem);
    }
    
    function downloadAllImages() {
        compressedImages.forEach(img => {
            const link = document.createElement('a');
            link.href = img.compressedDataUrl;
            link.download = getCompressedFileName(img.name);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }
    
    function getCompressedFileName(originalName) {
        const lastDotIndex = originalName.lastIndexOf('.');
        if (lastDotIndex === -1) {
            return `${originalName}-compressed`;
        }
        
        const namePart = originalName.substring(0, lastDotIndex);
        const extension = originalName.substring(lastDotIndex);
        
        return `${namePart}-compressed${extension}`;
    }
    
    function formatSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
});