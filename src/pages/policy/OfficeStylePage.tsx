import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PenTool, Settings, FileText, Tag, Users } from 'lucide-react';

export default function OfficeStylePage() {
  const navigate = useNavigate();

  const styleCategories = [
    {
      title: 'Letter Templates',
      description: 'Manage templates for different types of correspondence',
      icon: FileText,
      status: 'Coming Soon',
    },
    {
      title: 'Response Guidelines',
      description: 'Set tone, style, and policy position guidelines',
      icon: PenTool,
      status: 'Coming Soon',
    },
    {
      title: 'Tag Taxonomy',
      description: 'Configure tags and categories for organizing emails',
      icon: Tag,
      status: 'Coming Soon',
    },
    {
      title: 'Signature Settings',
      description: 'Manage email signatures for different staff members',
      icon: Users,
      status: 'Coming Soon',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Office Style</h1>
          <p className="text-muted-foreground">
            Configure your office's communication style and templates
          </p>
        </div>
        <Button onClick={() => navigate('/settings')}>
          <Settings className="mr-2 h-4 w-4" />
          Go to Settings
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Style Configuration</CardTitle>
          <CardDescription>
            Customize how your office communicates with constituents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {styleCategories.map((category) => {
              const Icon = category.icon;
              return (
                <Card key={category.title} className="relative">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {category.title}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {category.description}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {category.status}
                      </span>
                      <Button variant="outline" size="sm" disabled>
                        Configure
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common style and template management tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Default Email Signature</p>
              <p className="text-sm text-muted-foreground">
                Set your default email signature
              </p>
            </div>
            <Button variant="outline" size="sm" disabled>
              Edit
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Automated Response Templates</p>
              <p className="text-sm text-muted-foreground">
                Create templates for common policy responses
              </p>
            </div>
            <Button variant="outline" size="sm" disabled>
              Manage
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Office Branding</p>
              <p className="text-sm text-muted-foreground">
                Configure letterhead and branding elements
              </p>
            </div>
            <Button variant="outline" size="sm" disabled>
              Customize
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <PenTool className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-lg font-medium">
            Office Style Settings Coming Soon
          </p>
          <p className="text-sm text-muted-foreground max-w-md mt-2">
            This feature will allow you to configure templates, response
            guidelines, and communication styles for your office. In the meantime,
            you can manage basic settings in the Settings page.
          </p>
          <Button className="mt-4" onClick={() => navigate('/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            Go to Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
