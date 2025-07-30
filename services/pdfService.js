const pdfParse = require('pdf-parse');

class PDFService {
  static async parsePDF(buffer) {
    try {
      const pdfData = await pdfParse(buffer);
      const extractedText = pdfData.text.trim();
      
      if (!extractedText || extractedText.length === 0) {
        throw new Error('Could not extract text from PDF. The file might be empty or contain only images.');
      }

      // Extract page information for citations
      const pages = this.extractPages(extractedText, pdfData.numpages);
      
      return {
        text: extractedText,
        pages: pages,
        numPages: pdfData.numpages,
        info: pdfData.info,
        metadata: pdfData.metadata,
      };
    } catch (error) {
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  static async parsePDFFromFile(filePath) {
    try {
      const fs = require('fs');
      const buffer = fs.readFileSync(filePath);
      return await this.parsePDF(buffer);
    } catch (error) {
      throw new Error(`PDF file parsing failed: ${error.message}`);
    }
  }

  static extractPages(text, numPages) {
    const pages = [];
    
    // Try to find page breaks using common patterns
    const pageBreakPatterns = [
      /\f/g, // Form feed character
      /\n\s*\n\s*\n/g, // Multiple newlines
      /\n\s*Page\s+\d+\s*\n/gi, // "Page X" markers
      /\n\s*\d+\s*\n/g, // Standalone page numbers
      /\n\s*[A-Z][A-Z\s]+\n/g, // Section headers (like "TIMELINE", "PAYMENT TERMS")
    ];
    
    let pageTexts = [text];
    
    // Try to split by page breaks
    for (const pattern of pageBreakPatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length >= numPages - 1) {
        pageTexts = text.split(pattern);
        break;
      }
    }
    
    // If we couldn't find proper page breaks, use a more intelligent split
    if (pageTexts.length === 1) {
      pageTexts = this.intelligentPageSplit(text, numPages);
    }
    
    // Create page objects with better content analysis
    for (let i = 0; i < numPages; i++) {
      const pageText = pageTexts[i] || '';
      const cleanText = pageText.trim();
      
      // Analyze page content for better identification
      const hasTimeline = cleanText.toLowerCase().includes('timeline');
      const hasPayment = cleanText.toLowerCase().includes('payment');
      const hasQuotation = cleanText.toLowerCase().includes('quotation');
      const hasTotal = cleanText.toLowerCase().includes('total');
      
      pages.push({
        pageNumber: i + 1,
        text: cleanText,
        startIndex: text.indexOf(cleanText),
        endIndex: text.indexOf(cleanText) + cleanText.length,
        wordCount: cleanText.split(/\s+/).length,
        hasTimeline: hasTimeline,
        hasPayment: hasPayment,
        hasQuotation: hasQuotation,
        hasTotal: hasTotal,
      });
    }
    
    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      pages.forEach(page => {
        console.log(`Page ${page.pageNumber}: ${page.wordCount} words`);
        console.log(`  Timeline: ${page.hasTimeline}, Payment: ${page.hasPayment}, Quotation: ${page.hasQuotation}, Total: ${page.hasTotal}`);
      });
    }
    
    return pages;
  }

  static intelligentPageSplit(text, numPages) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentencesPerPage = Math.ceil(sentences.length / numPages);
    const pages = [];
    
    for (let i = 0; i < numPages; i++) {
      const startIndex = i * sentencesPerPage;
      const endIndex = Math.min((i + 1) * sentencesPerPage, sentences.length);
      const pageSentences = sentences.slice(startIndex, endIndex);
      pages.push(pageSentences.join('. '));
    }
    
    return pages;
  }

  static findRelevantPages(query, pages, maxPages = 3) {
    // Simple keyword matching to find relevant pages
    const queryWords = query.toLowerCase().split(' ');
    const pageScores = pages.map((page, index) => {
      const pageText = page.text.toLowerCase();
      let score = 0;
      
      queryWords.forEach(word => {
        if (pageText.includes(word)) {
          score += 1;
        }
      });
      
      return { pageNumber: index + 1, score };
    });
    
    // Sort by score and return top pages
    return pageScores
      .filter(page => page.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPages)
      .map(page => page.pageNumber);
  }

  static generateCitation(pageNumbers) {
    if (!pageNumbers || pageNumbers.length === 0) {
      return null;
    }
    
    if (pageNumbers.length === 1) {
      return `Page ${pageNumbers[0]}`;
    }
    
    return `Pages ${pageNumbers.join(', ')}`;
  }
}

module.exports = PDFService; 