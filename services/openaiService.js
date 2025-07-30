const OpenAI = require('openai');

class OpenAIService {
  constructor() {
    this.openai = null;
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  async generateResponse(message, documentContent, pages = null) {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    // Enhanced prompt to force page citations
    const systemPrompt = `You are a helpful AI assistant that answers questions about documents. 
Answer questions based strictly on the provided document content.
Keep responses concise and accurate.
If information is not in the document, say so politely.

CRITICAL INSTRUCTIONS FOR PAGE CITATIONS:
1. The document content is organized by pages with clear "--- PAGE X ---" markers
2. You MUST analyze which specific page contains the information you're referencing
3. Always end your response with page citations in this format: [Page X] or [Pages X, Y]
4. Be extremely precise about which page contains the specific information
5. If you mention timeline information, check which page actually contains the timeline section
6. If you mention payment information, check which page contains payment details
7. Do NOT guess or assume page numbers - only cite pages where the information actually appears`;

    // Truncate content to stay within token limits (approximately 4000 characters)
    const maxContentLength = 3500; // Leave room for prompt and response
    const truncatedContent = documentContent.length > maxContentLength 
      ? documentContent.substring(0, maxContentLength) + '...'
      : documentContent;

    // Create page-by-page content for better context
    let pageContext = '';
    if (pages && pages.length > 0) {
      pageContext = pages.map(page => 
        `--- PAGE ${page.pageNumber} ---\n${page.text}\n`
      ).join('\n');
    }

    const userPrompt = `Document content (organized by pages):
${pageContext || truncatedContent}

User question: ${message}

IMPORTANT: Analyze the content page by page and cite the EXACT page number where the information is found. Always include page citations at the end in format [Page X] or [Pages X, Y].`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 800, // Limit response length for efficiency
        temperature: 0.7,
      });

      const responseText = completion.choices[0].message.content;
      
      // Extract citations from response
      const citations = this.extractCitations(responseText, pages);
      
      // Validate citations against actual content
      const validatedCitations = this.validateCitations(citations, responseText, pages);
      
      // Debug logging for page detection
      if (process.env.NODE_ENV === 'development') {
        console.log('Response text:', responseText.substring(0, 100) + '...');
        console.log('Original citations:', citations);
        console.log('Validated citations:', validatedCitations);
        if (validatedCitations.length === 0 && pages.length > 0) {
          const relevantPages = this.findRelevantPages(responseText, pages);
          console.log('Fallback relevant pages:', relevantPages);
        }
      }
      
      return {
        response: responseText,
        citations: validatedCitations,
        usage: {
          model: 'gpt-4',
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  extractCitations(responseText, pages) {
    if (!pages) return [];
    
    const citations = [];
    
    // First, try to extract citations from the new format [Page X] or [Pages X, Y]
    const bracketMatches = responseText.match(/\[Page(?:s)?\s+(\d+(?:\s*,\s*\d+)*)\]/gi);
    
    if (bracketMatches) {
      bracketMatches.forEach(match => {
        const pageNumbers = match.match(/\d+/g);
        pageNumbers.forEach(pageNum => {
          const pageNumber = parseInt(pageNum);
          if (pageNumber >= 1 && pageNumber <= pages.length) {
            citations.push({
              pageNumber: pageNumber,
              text: `Page ${pageNumber}`,
            });
          }
        });
      });
    }
    
    // If no bracket citations found, try the old format "page X"
    if (citations.length === 0) {
      const pageMatches = responseText.match(/page\s+(\d+)/gi);
      
      if (pageMatches) {
        pageMatches.forEach(match => {
          const pageNumber = parseInt(match.match(/\d+/)[0]);
          if (pageNumber >= 1 && pageNumber <= pages.length) {
            citations.push({
              pageNumber: pageNumber,
              text: `Page ${pageNumber}`,
            });
          }
        });
      }
    }
    
    // If still no citations found, use intelligent page detection with validation
    if (citations.length === 0 && pages.length > 0) {
      const relevantPages = this.findRelevantPages(responseText, pages);
      relevantPages.forEach(pageNumber => {
        if (pageNumber >= 1 && pageNumber <= pages.length) {
          citations.push({
            pageNumber: pageNumber,
            text: `Page ${pageNumber}`,
          });
        }
      });
    }
    
    // Remove duplicates and sort by page number
    const uniqueCitations = citations.filter((citation, index, self) => 
      index === self.findIndex(c => c.pageNumber === citation.pageNumber)
    ).sort((a, b) => a.pageNumber - b.pageNumber);
    
    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log('Final citations:', uniqueCitations);
      console.log('Available pages:', pages.length);
    }
    
    return uniqueCitations;
  }

  validateCitations(citations, responseText, pages) {
    if (!citations.length || !pages.length) return citations;
    
    const validatedCitations = [];
    
    citations.forEach(citation => {
      const page = pages.find(p => p.pageNumber === citation.pageNumber);
      if (!page) return;
      
      // Extract key phrases from the response
      const responsePhrases = responseText.toLowerCase()
        .split(/[.!?]+/)
        .map(phrase => phrase.trim())
        .filter(phrase => phrase.length > 10);
      
      // Check if the cited page actually contains the information
      let hasRelevantContent = false;
      const pageText = page.text.toLowerCase();
      
      responsePhrases.forEach(phrase => {
        if (pageText.includes(phrase.toLowerCase())) {
          hasRelevantContent = true;
        }
      });
      
      // If the cited page doesn't contain relevant content, try to find the correct page
      if (!hasRelevantContent) {
        const correctPage = this.findCorrectPage(responseText, pages);
        if (correctPage && correctPage !== citation.pageNumber) {
          validatedCitations.push({
            pageNumber: correctPage,
            text: `Page ${correctPage}`,
          });
          return;
        }
      }
      
      validatedCitations.push(citation);
    });
    
    return validatedCitations;
  }

  findCorrectPage(responseText, pages) {
    // Find the page that actually contains the most relevant content
    const pageScores = pages.map((page, index) => {
      const pageText = page.text.toLowerCase();
      const responseWords = responseText.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 4);
      
      let score = 0;
      responseWords.forEach(word => {
        if (pageText.includes(word)) {
          score += 1;
        }
      });
      
      return { pageNumber: index + 1, score };
    });
    
    const bestPage = pageScores
      .sort((a, b) => b.score - a.score)
      .find(page => page.score > 0);
    
    return bestPage ? bestPage.pageNumber : null;
  }

  findRelevantPages(responseText, pages) {
    // Enhanced keyword matching with better scoring
    const responseWords = responseText.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3) // Only meaningful words
      .map(word => word.replace(/[^\w]/g, '')); // Remove punctuation
    
    const pageScores = pages.map((page, index) => {
      const pageText = page.text.toLowerCase();
      let score = 0;
      let exactMatches = 0;
      let phraseMatches = 0;
      
      // Check for exact phrases from the response
      const responsePhrases = responseText.toLowerCase()
        .split(/[.!?]+/)
        .map(phrase => phrase.trim())
        .filter(phrase => phrase.length > 10); // Only meaningful phrases
      
      responsePhrases.forEach(phrase => {
        if (pageText.includes(phrase)) {
          phraseMatches += 1;
        }
      });
      
      responseWords.forEach(word => {
        if (pageText.includes(word)) {
          score += 1;
          // Bonus for exact word matches
          const wordRegex = new RegExp(`\\b${word}\\b`, 'gi');
          const matches = pageText.match(wordRegex);
          if (matches) {
            exactMatches += matches.length;
          }
        }
      });
      
      // Calculate relevance score with higher weight for phrase matches
      const relevanceScore = (score * 2) + (exactMatches * 0.5) + (phraseMatches * 10) + (page.wordCount * 0.001);
      
      return { 
        pageNumber: index + 1, 
        score: relevanceScore,
        wordMatches: score,
        exactMatches: exactMatches,
        phraseMatches: phraseMatches
      };
    });
    
    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log('Page scores:', pageScores);
    }
    
    // Return pages with highest scores (top 2 pages)
    const relevantPages = pageScores
      .filter(page => page.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);
    
    // Only return pages with significant relevance
    return relevantPages
      .filter(page => page.wordMatches >= 2 || page.phraseMatches >= 1) // At least 2 word matches OR 1 phrase match
      .map(page => page.pageNumber);
  }

  async testConnection() {
    if (!this.openai) {
      return { success: false, error: 'OpenAI API key not configured' };
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
      });
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = OpenAIService; 