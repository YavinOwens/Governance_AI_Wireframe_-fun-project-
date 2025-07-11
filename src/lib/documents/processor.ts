import OpenAI from 'openai';
import { insertDocumentEmbedding, vectorSimilaritySearch, executeQuery } from '../database/connection';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️ OPENAI_API_KEY not found in environment variables. Document processing features will be disabled.');
}

export interface DocumentChunk {
  text: string;
  index: number;
  size: number;
}

export interface DocumentEmbedding {
  documentId: string;
  embedding: number[];
  chunkText: string;
  chunkIndex: number;
  chunkSize: number;
}

export class DocumentProcessor {
  private static readonly CHUNK_SIZE = 1000; // Characters per chunk
  private static readonly CHUNK_OVERLAP = 200; // Overlap between chunks

  /**
   * Extract text content from various document types
   */
  static async extractTextContent(filePath: string, mimeType: string): Promise<string> {
    // This is a simplified implementation
    // In production, you'd use libraries like pdf-parse, mammoth, etc.
    
    try {
      const fs = require('fs');
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Basic text extraction - in production, use proper parsers
      if (mimeType.includes('pdf')) {
        // Use pdf-parse for PDF files
        return content; // Simplified
      } else if (mimeType.includes('word') || mimeType.includes('document')) {
        // Use mammoth for Word documents
        return content; // Simplified
      } else if (mimeType.includes('spreadsheet')) {
        // Use xlsx for Excel files
        return content; // Simplified
      } else {
        return content;
      }
    } catch (error) {
      console.error('Error extracting text content:', error);
      throw error;
    }
  }

  /**
   * Split text into chunks for embedding
   */
  static chunkText(text: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      const endIndex = Math.min(startIndex + this.CHUNK_SIZE, text.length);
      const chunkText = text.slice(startIndex, endIndex);

      chunks.push({
        text: chunkText,
        index: chunks.length,
        size: chunkText.length,
      });

      startIndex = endIndex - this.CHUNK_OVERLAP;
    }

    return chunks;
  }

  /**
   * Generate embeddings for text chunks using OpenAI
   */
  static async generateEmbeddings(chunks: DocumentChunk[]): Promise<number[][]> {
    try {
      const embeddings: number[][] = [];

      for (const chunk of chunks) {
        const response = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: chunk.text,
          encoding_format: "float",
        });

        embeddings.push(response.data[0].embedding);
      }

      return embeddings;
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw error;
    }
  }

  /**
   * Process and store document with embeddings
   */
  static async processDocument(
    documentId: string,
    filePath: string,
    mimeType: string,
    metadata: any = {}
  ): Promise<void> {
    try {
      console.log(`🔄 Processing document: ${documentId}`);

      // Extract text content
      const textContent = await this.extractTextContent(filePath, mimeType);
      console.log(`📝 Extracted ${textContent.length} characters`);

      // Update document with content
      await executeQuery(
        'UPDATE documents SET content_text = $1 WHERE id = $2',
        [textContent, documentId]
      );

      // Chunk the text
      const chunks = this.chunkText(textContent);
      console.log(`📦 Created ${chunks.length} chunks`);

      // Generate embeddings
      const embeddings = await this.generateEmbeddings(chunks);
      console.log(`🤖 Generated ${embeddings.length} embeddings`);

      // Store embeddings in database
      for (let i = 0; i < chunks.length; i++) {
        await insertDocumentEmbedding(
          documentId,
          embeddings[i],
          chunks[i].text,
          chunks[i].index,
          chunks[i].size
        );
      }

      console.log(`✅ Document processing completed: ${documentId}`);
    } catch (error) {
      console.error('Error processing document:', error);
      throw error;
    }
  }

  /**
   * Search for similar documents using vector similarity
   */
  static async searchSimilarDocuments(
    query: string,
    limit: number = 5,
    threshold: number = 0.7
  ): Promise<any[]> {
    try {
      // Generate embedding for the query
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
        encoding_format: "float",
      });

      const queryEmbedding = response.data[0].embedding;

      // Search for similar documents
      const results = await vectorSimilaritySearch(queryEmbedding, 'document_embeddings', limit, threshold);

      return results;
    } catch (error) {
      console.error('Error searching similar documents:', error);
      throw error;
    }
  }

  /**
   * Analyze document content using AI
   */
  static async analyzeDocument(
    documentId: string,
    analysisType: string = 'governance'
  ): Promise<string> {
    try {
      // Get document content
      const result = await executeQuery(
        'SELECT content_text, name, document_type FROM documents WHERE id = $1',
        [documentId]
      );

      if (result.rows.length === 0) {
        throw new Error('Document not found');
      }

      const document = result.rows[0];
      const content = document.content_text || '';

      // Generate analysis prompt based on type
      let prompt = '';
      switch (analysisType) {
        case 'governance':
          prompt = `Analyze the following document for governance insights:
            
            Document: ${document.name}
            Type: ${document.type}
            Content: ${content.substring(0, 4000)}
            
            Please provide:
            1. Key governance insights and findings
            2. Identified risks and opportunities
            3. Compliance considerations
            4. Recommendations for improvement
            5. Action items and next steps
            
            Format the response as a structured analysis report.`;
          break;
        case 'compliance':
          prompt = `Analyze the following document for compliance considerations:
            
            Document: ${document.name}
            Content: ${content.substring(0, 4000)}
            
            Please provide:
            1. Compliance requirements identified
            2. Potential compliance risks
            3. Regulatory considerations
            4. Recommendations for compliance
            5. Required actions
            
            Format the response as a compliance analysis report.`;
          break;
        default:
          prompt = `Analyze the following document:
            
            Document: ${document.name}
            Content: ${content.substring(0, 4000)}
            
            Please provide a comprehensive analysis including key insights, findings, and recommendations.`;
      }

      // Generate analysis using OpenAI
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert governance analyst specializing in document review and strategic analysis."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.5,
        max_tokens: 1500
      });

      const analysis = completion.choices[0].message.content;

      // Update document with analysis
      await executeQuery(
        'UPDATE documents SET ai_analysis = $1, analysis_type = $2 WHERE id = $3',
        [analysis, analysisType, documentId]
      );

      return analysis || 'Analysis completed';
    } catch (error) {
      console.error('Error analyzing document:', error);
      throw error;
    }
  }

  /**
   * Get document statistics
   */
  static async getDocumentStats(): Promise<any> {
    try {
      const stats = await executeQuery(`
        SELECT 
          COUNT(*) as total_documents,
          COUNT(CASE WHEN ai_analysis IS NOT NULL THEN 1 END) as analyzed_documents,
          COUNT(CASE WHEN content_text IS NOT NULL THEN 1 END) as processed_documents,
          SUM(file_size) as total_size,
          AVG(file_size) as avg_size
        FROM documents
      `);

      const typeStats = await executeQuery(`
        SELECT 
          document_type,
          COUNT(*) as count
        FROM documents
        GROUP BY document_type
        ORDER BY count DESC
      `);

      const embeddingStats = await executeQuery(`
        SELECT 
          COUNT(*) as total_embeddings,
          COUNT(DISTINCT document_id) as documents_with_embeddings
        FROM document_embeddings
      `);

      return {
        ...stats.rows[0],
        typeBreakdown: typeStats.rows,
        embeddingStats: embeddingStats.rows[0]
      };
    } catch (error) {
      console.error('Error getting document stats:', error);
      throw error;
    }
  }
} 