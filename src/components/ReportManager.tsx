'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  FileText, 
  Download, 
  Eye, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Plus,
  Filter,
  Search,
  Settings,
  BarChart3,
  Shield,
  Users,
  Database
} from 'lucide-react';

interface ReportTemplate {
  id: string;
  name: string;
  category: 'governance' | 'data-quality' | 'workshop' | 'analysis' | 'compliance';
  description?: string;
  isActive: boolean;
  metadata: {
    version: string;
    author: string;
    accessibility_compliant: boolean;
  };
}

interface GeneratedReport {
  id: string;
  templateId: string;
  title: string;
  status: 'draft' | 'review' | 'approved' | 'published' | 'archived';
  generatedBy: string;
  generatedAt: Date;
  metadata: {
    wordCount: number;
    estimatedReadTime: number;
  };
  tags: string[];
}

const categoryIcons = {
  governance: Users,
  'data-quality': Database,
  workshop: BarChart3,
  analysis: BarChart3,
  compliance: Shield,
};

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  published: 'bg-blue-100 text-blue-800',
  archived: 'bg-gray-100 text-gray-600',
};

export default function ReportManager() {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewContent, setPreviewContent] = useState('');

  // Form state for report generation
  const [reportForm, setReportForm] = useState({
    title: '',
    executiveSummary: '',
    keyFindings: '',
    recommendations: '',
    category: '',
  });

  useEffect(() => {
    loadTemplates();
    loadReports();
  }, []);

  const loadTemplates = async () => {
    try {
      setIsLoadingTemplates(true);
      const response = await fetch('/api/reports?action=templates');
      const result = await response.json();
      
      if (result.success) {
        setTemplates(result.data);
      } else {
        console.error('Failed to load templates:', result.error);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const loadReports = async () => {
    try {
      setIsLoadingReports(true);
      const response = await fetch('/api/reports?action=reports');
      const result = await response.json();
      
      if (result.success) {
        setReports(result.data.map((report: any) => ({
          ...report,
          generatedAt: new Date(report.generatedAt),
        })));
      } else {
        console.error('Failed to load reports:', result.error);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setIsLoadingReports(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedTemplate || !reportForm.title) {
      alert('Please select a template and provide a title');
      return;
    }

    try {
      setIsGenerating(true);
      
      const template = templates.find(t => t.id === selectedTemplate);
      if (!template) {
        alert('Selected template not found');
        return;
      }

      const endpoint = getGenerationEndpoint(template.category);
      const reportData = prepareReportData(template.category);

      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: endpoint,
          data: {
            ...reportData,
            generatedBy: 'user', // In a real app, this would be the authenticated user
          },
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        alert('Report generated successfully!');
        setShowGenerateDialog(false);
        setReportForm({
          title: '',
          executiveSummary: '',
          keyFindings: '',
          recommendations: '',
          category: '',
        });
        loadReports(); // Refresh the reports list
      } else {
        alert(`Failed to generate report: ${result.error}`);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert('An error occurred while generating the report');
    } finally {
      setIsGenerating(false);
    }
  };

  const getGenerationEndpoint = (category: string): string => {
    switch (category) {
      case 'governance':
        return 'generate-governance-report';
      case 'data-quality':
        return 'generate-data-quality-report';
      case 'compliance':
        return 'generate-compliance-report';
      default:
        return 'generate-report';
    }
  };

  const prepareReportData = (category: string) => {
    const baseData = {
      title: reportForm.title,
      executiveSummary: reportForm.executiveSummary,
    };

    switch (category) {
      case 'governance':
        return {
          ...baseData,
          workshopOutcomes: parseListInput(reportForm.keyFindings, 'Workshop Outcome'),
          keyFindings: parseListInput(reportForm.keyFindings, 'Finding'),
          recommendations: parseListInput(reportForm.recommendations, 'Recommendation'),
        };
      
      case 'data-quality':
        return {
          ...baseData,
          dataQualityMetrics: [
            {
              tableName: 'Sample Table',
              overallScore: 85,
              totalMetrics: 10,
              passedMetrics: 7,
              warningMetrics: 2,
              failedMetrics: 1,
            },
          ],
          keyFindings: parseListInput(reportForm.keyFindings, 'Data Quality Issue'),
          recommendations: parseListInput(reportForm.recommendations, 'Quality Improvement'),
        };
      
      case 'compliance':
        return {
          ...baseData,
          complianceAreas: [
            { area: 'Data Privacy', status: 'compliant', description: 'All privacy controls in place' },
            { area: 'Security Controls', status: 'partial', description: 'Some gaps identified' },
          ],
          findings: parseListInput(reportForm.keyFindings, 'Compliance Finding'),
          recommendations: parseListInput(reportForm.recommendations, 'Remediation Action'),
        };
      
      default:
        return baseData;
    }
  };

  const parseListInput = (input: string, prefix: string) => {
    if (!input.trim()) return [];
    
    return input.split('\n').filter(line => line.trim()).map((line, index) => ({
      title: `${prefix} ${index + 1}`,
      description: line.trim(),
      priority: index === 0 ? 'high' : 'medium',
    }));
  };

  const handlePreviewReport = async (reportId: string) => {
    try {
      const response = await fetch(`/api/reports?action=preview&id=${reportId}`);
      
      if (response.ok) {
        const htmlContent = await response.text();
        setPreviewContent(htmlContent);
        setShowPreviewDialog(true);
      } else {
        alert('Failed to load report preview');
      }
    } catch (error) {
      console.error('Error loading preview:', error);
      alert('An error occurred while loading the preview');
    }
  };

  const handleApproveReport = async (reportId: string) => {
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'approve-report',
          data: {
            reportId,
            approvedBy: 'user', // In a real app, this would be the authenticated user
          },
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        alert('Report approved successfully!');
        loadReports(); // Refresh the reports list
      } else {
        alert(`Failed to approve report: ${result.error}`);
      }
    } catch (error) {
      console.error('Error approving report:', error);
      alert('An error occurred while approving the report');
    }
  };

  const filteredTemplates = templates.filter(template => {
    const categoryMatch = selectedCategory === 'all' || template.category === selectedCategory;
    const searchMatch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       template.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return categoryMatch && searchMatch;
  });

  const filteredReports = reports.filter(report => {
    const statusMatch = selectedStatus === 'all' || report.status === selectedStatus;
    const searchMatch = report.title.toLowerCase().includes(searchTerm.toLowerCase());
    return statusMatch && searchMatch;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Report Management</h2>
          <p className="text-gray-600">Create, manage, and preview professional reports</p>
        </div>
        <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
          <DialogTrigger asChild>
            <Button className="flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>Generate Report</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Generate New Report</DialogTitle>
              <DialogDescription>
                Select a template and provide the necessary information to generate a professional report.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Report Template
                </label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name} ({template.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Report Title
                </label>
                <Input
                  value={reportForm.title}
                  onChange={(e) => setReportForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter report title"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Executive Summary
                </label>
                <Textarea
                  value={reportForm.executiveSummary}
                  onChange={(e) => setReportForm(prev => ({ ...prev, executiveSummary: e.target.value }))}
                  placeholder="Provide a brief executive summary"
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Key Findings (one per line)
                </label>
                <Textarea
                  value={reportForm.keyFindings}
                  onChange={(e) => setReportForm(prev => ({ ...prev, keyFindings: e.target.value }))}
                  placeholder="Enter key findings, one per line"
                  rows={4}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recommendations (one per line)
                </label>
                <Textarea
                  value={reportForm.recommendations}
                  onChange={(e) => setReportForm(prev => ({ ...prev, recommendations: e.target.value }))}
                  placeholder="Enter recommendations, one per line"
                  rows={4}
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowGenerateDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerateReport}
                  disabled={isGenerating || !selectedTemplate || !reportForm.title}
                >
                  {isGenerating ? 'Generating...' : 'Generate Report'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="reports" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="reports">Generated Reports</TabsTrigger>
          <TabsTrigger value="templates">Report Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-4">
          <div className="flex space-x-4 items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search reports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoadingReports ? (
            <div className="flex justify-center items-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReports.map((report) => (
                <Card key={report.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg line-clamp-2">{report.title}</CardTitle>
                      <Badge className={statusColors[report.status]}>
                        {report.status}
                      </Badge>
                    </div>
                    <CardDescription>
                      Generated on {report.generatedAt.toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>{report.metadata.wordCount} words</span>
                        <span>{report.metadata.estimatedReadTime} min read</span>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePreviewReport(report.id)}
                          className="flex items-center space-x-1"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Preview</span>
                        </Button>
                        
                        {report.status === 'draft' || report.status === 'review' ? (
                          <Button
                            size="sm"
                            onClick={() => handleApproveReport(report.id)}
                            className="flex items-center space-x-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>Approve</span>
                          </Button>
                        ) : null}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex items-center space-x-1"
                        >
                          <Download className="w-4 h-4" />
                          <span>Export</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex space-x-4 items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="governance">Governance</SelectItem>
                <SelectItem value="data-quality">Data Quality</SelectItem>
                <SelectItem value="workshop">Workshop</SelectItem>
                <SelectItem value="analysis">Analysis</SelectItem>
                <SelectItem value="compliance">Compliance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoadingTemplates ? (
            <div className="flex justify-center items-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => {
                const IconComponent = categoryIcons[template.category];
                return (
                  <Card key={template.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <IconComponent className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          <CardDescription>{template.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary">{template.category}</Badge>
                          <span className="text-sm text-gray-500">v{template.metadata.version}</span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {template.metadata.accessibility_compliant && (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Accessible
                            </Badge>
                          )}
                          <Badge variant="outline">
                            By {template.metadata.author}
                          </Badge>
                        </div>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedTemplate(template.id);
                            setShowGenerateDialog(true);
                          }}
                          className="w-full"
                        >
                          Use Template
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Report Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Report Preview</DialogTitle>
            <DialogDescription>
              Preview of the generated report. This shows how the report will appear when exported.
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg p-4 bg-white">
            <iframe
              srcDoc={previewContent}
              className="w-full h-96 border-0"
              title="Report Preview"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 