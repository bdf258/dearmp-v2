import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDummyData } from '@/lib/useDummyData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';

export default function NewCasePage() {
  const navigate = useNavigate();
  const { users, constituents } = useDummyData();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assigned_to_user_id: '',
    constituent_id: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Creating new case:', formData);
    // In a real app, this would submit to the backend
    // For now, just navigate back to cases
    navigate('/casework/cases');
  };

  const handleChange = (
    field: string,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/casework/cases')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create New Case</h1>
          <p className="text-muted-foreground">
            Open a new case for a constituent issue
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Case Details</CardTitle>
          <CardDescription>
            Fill in the information below to create a new case
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Constituent Selection */}
              <div className="space-y-2">
                <Label htmlFor="constituent">Constituent *</Label>
                <Select
                  value={formData.constituent_id}
                  onValueChange={(value) => handleChange('constituent_id', value)}
                  required
                >
                  <SelectTrigger id="constituent">
                    <SelectValue placeholder="Select constituent" />
                  </SelectTrigger>
                  <SelectContent>
                    {constituents.map((constituent) => (
                      <SelectItem key={constituent.id} value={constituent.id}>
                        {constituent.first_name} {constituent.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assigned To */}
              <div className="space-y-2">
                <Label htmlFor="assigned_to">Assign To *</Label>
                <Select
                  value={formData.assigned_to_user_id}
                  onValueChange={(value) => handleChange('assigned_to_user_id', value)}
                  required
                >
                  <SelectTrigger id="assigned_to">
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Case Title *</Label>
              <Input
                id="title"
                placeholder="Brief description of the issue"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Detailed description of the case..."
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={6}
                required
              />
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority *</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => handleChange('priority', value)}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/casework/cases')}
              >
                Cancel
              </Button>
              <Button type="submit">
                <Save className="mr-2 h-4 w-4" />
                Create Case
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Constituent:</strong> Select the primary constituent this case is
            for. You can add additional participants after creating the case.
          </p>
          <p>
            <strong>Priority:</strong> Set the urgency level. High priority cases will
            be highlighted in the case list.
          </p>
          <p>
            <strong>Description:</strong> Provide as much detail as possible to help
            track and resolve the issue effectively.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
