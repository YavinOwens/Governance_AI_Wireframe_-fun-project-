import { NextRequest, NextResponse } from 'next/server';
import { ReportTemplateManager, ReportData } from '../../../lib/reports/ReportTemplateManager';

const reportManager = new ReportTemplateManager();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const reportId = searchParams.get('id');

    switch (action) {
      case 'templates':
        const templates = await reportManager.getTemplates(category || undefined);
        return NextResponse.json({
          success: true,
          data: templates,
          message: `Retrieved ${templates.length} templates`,
        });

      case 'reports':
        const reports = await reportManager.getGeneratedReports(status || undefined);
        return NextResponse.json({
          success: true,
          data: reports,
          message: `Retrieved ${reports.length} reports`,
        });

      case 'report':
        if (!reportId) {
          return NextResponse.json(
            { success: false, error: 'Report ID is required' },
            { status: 400 }
          );
        }
        
        const report = (await reportManager.getGeneratedReports()).find(r => r.id === reportId);
        if (!report) {
          return NextResponse.json(
            { success: false, error: 'Report not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          data: report,
        });

      case 'preview':
        if (!reportId) {
          return NextResponse.json(
            { success: false, error: 'Report ID is required' },
            { status: 400 }
          );
        }
        
        const previewReport = (await reportManager.getGeneratedReports()).find(r => r.id === reportId);
        if (!previewReport) {
          return NextResponse.json(
            { success: false, error: 'Report not found' },
            { status: 404 }
          );
        }

        // Return HTML content for preview
        return new NextResponse(previewReport.htmlContent, {
          headers: {
            'Content-Type': 'text/html',
          },
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: templates, reports, report, or preview' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in reports GET API:', error);
    return NextResponse.json(
      { success: false, error: `Failed to process request: ${error}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'action is required' },
        { status: 400 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'data is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'generate-report':
        return await generateReport(data);
      
      case 'create-template':
        return await createTemplate(data);
      
      case 'update-template':
        return await updateTemplate(data);
      
      case 'generate-governance-report':
        return await generateGovernanceReport(data);
      
      case 'generate-data-quality-report':
        return await generateDataQualityReport(data);
      
      case 'generate-compliance-report':
        return await generateComplianceReport(data);

      case 'approve-report':
        return await approveReport(data);

      case 'update-report-status':
        return await updateReportStatus(data);

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in reports POST API:', error);
    return NextResponse.json(
      { success: false, error: `Failed to process request: ${error}` },
      { status: 500 }
    );
  }
}

async function generateReport(data: any): Promise<NextResponse> {
  const { templateId, reportData, generatedBy } = data;

  if (!templateId || !reportData || !generatedBy) {
    return NextResponse.json(
      { success: false, error: 'templateId, reportData, and generatedBy are required' },
      { status: 400 }
    );
  }

  try {
    const report = await reportManager.generateReport(templateId, reportData, generatedBy);
    return NextResponse.json({
      success: true,
      data: report,
      message: 'Report generated successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Failed to generate report: ${error}` },
      { status: 500 }
    );
  }
}

async function generateGovernanceReport(data: any): Promise<NextResponse> {
  const { title, workshopOutcomes, keyFindings, recommendations, executiveSummary, generatedBy } = data;

  if (!title || !generatedBy) {
    return NextResponse.json(
      { success: false, error: 'title and generatedBy are required' },
      { status: 400 }
    );
  }

  try {
    // Get governance template
    const templates = await reportManager.getTemplates('governance');
    const governanceTemplate = templates.find(t => t.name === 'Governance Workshop Report');
    
    if (!governanceTemplate) {
      return NextResponse.json(
        { success: false, error: 'Governance template not found' },
        { status: 404 }
      );
    }

    const reportData: ReportData = {
      title,
      generationDate: new Date(),
      version: '1.0',
      executiveSummary: executiveSummary || 'This report summarizes the outcomes and recommendations from the governance workshop.',
      workshopOutcomes: workshopOutcomes || [],
      keyFindings: keyFindings || [],
      recommendations: recommendations || [],
      customData: {
        reportType: 'governance',
        generatedBy,
      },
    };

    const report = await reportManager.generateReport(governanceTemplate.id, reportData, generatedBy);
    
    return NextResponse.json({
      success: true,
      data: report,
      message: 'Governance report generated successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Failed to generate governance report: ${error}` },
      { status: 500 }
    );
  }
}

async function generateDataQualityReport(data: any): Promise<NextResponse> {
  const { title, dataQualityMetrics, keyFindings, recommendations, executiveSummary, generatedBy } = data;

  if (!title || !generatedBy) {
    return NextResponse.json(
      { success: false, error: 'title and generatedBy are required' },
      { status: 400 }
    );
  }

  try {
    // Get data quality template
    const templates = await reportManager.getTemplates('data-quality');
    const dataQualityTemplate = templates.find(t => t.name === 'Data Quality Assessment Report');
    
    if (!dataQualityTemplate) {
      return NextResponse.json(
        { success: false, error: 'Data Quality template not found' },
        { status: 404 }
      );
    }

    const reportData: ReportData = {
      title,
      generationDate: new Date(),
      version: '1.0',
      executiveSummary: executiveSummary || 'This report provides a comprehensive assessment of data quality across the organization.',
      dataQualityMetrics: dataQualityMetrics || [],
      keyFindings: keyFindings || [],
      recommendations: recommendations || [],
      customData: {
        reportType: 'data-quality',
        generatedBy,
      },
    };

    const report = await reportManager.generateReport(dataQualityTemplate.id, reportData, generatedBy);
    
    return NextResponse.json({
      success: true,
      data: report,
      message: 'Data Quality report generated successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Failed to generate data quality report: ${error}` },
      { status: 500 }
    );
  }
}

async function generateComplianceReport(data: any): Promise<NextResponse> {
  const { title, complianceAreas, findings, recommendations, executiveSummary, generatedBy } = data;

  if (!title || !generatedBy) {
    return NextResponse.json(
      { success: false, error: 'title and generatedBy are required' },
      { status: 400 }
    );
  }

  try {
    // Get compliance template
    const templates = await reportManager.getTemplates('compliance');
    const complianceTemplate = templates.find(t => t.name === 'Compliance Assessment Report');
    
    if (!complianceTemplate) {
      return NextResponse.json(
        { success: false, error: 'Compliance template not found' },
        { status: 404 }
      );
    }

    const reportData: ReportData = {
      title,
      generationDate: new Date(),
      version: '1.0',
      executiveSummary: executiveSummary || 'This report details the compliance assessment findings and recommendations.',
      keyFindings: findings || [],
      recommendations: recommendations || [],
      customData: {
        reportType: 'compliance',
        complianceAreas: complianceAreas || [],
        generatedBy,
      },
    };

    const report = await reportManager.generateReport(complianceTemplate.id, reportData, generatedBy);
    
    return NextResponse.json({
      success: true,
      data: report,
      message: 'Compliance report generated successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Failed to generate compliance report: ${error}` },
      { status: 500 }
    );
  }
}

async function createTemplate(data: any): Promise<NextResponse> {
  try {
    const templateId = await reportManager.createOrUpdateTemplate(data);
    return NextResponse.json({
      success: true,
      data: { templateId },
      message: 'Template created successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Failed to create template: ${error}` },
      { status: 500 }
    );
  }
}

async function updateTemplate(data: any): Promise<NextResponse> {
  if (!data.id) {
    return NextResponse.json(
      { success: false, error: 'Template ID is required for updates' },
      { status: 400 }
    );
  }

  try {
    const templateId = await reportManager.createOrUpdateTemplate(data);
    return NextResponse.json({
      success: true,
      data: { templateId },
      message: 'Template updated successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Failed to update template: ${error}` },
      { status: 500 }
    );
  }
}

async function approveReport(data: any): Promise<NextResponse> {
  const { reportId, approvedBy } = data;

  if (!reportId || !approvedBy) {
    return NextResponse.json(
      { success: false, error: 'reportId and approvedBy are required' },
      { status: 400 }
    );
  }

  // Implementation would update the report status to 'approved'
  // For now, return success response
  return NextResponse.json({
    success: true,
    message: 'Report approved successfully',
  });
}

async function updateReportStatus(data: any): Promise<NextResponse> {
  const { reportId, status, updatedBy } = data;

  if (!reportId || !status || !updatedBy) {
    return NextResponse.json(
      { success: false, error: 'reportId, status, and updatedBy are required' },
      { status: 400 }
    );
  }

  // Implementation would update the report status
  // For now, return success response
  return NextResponse.json({
    success: true,
    message: `Report status updated to ${status}`,
  });
} 