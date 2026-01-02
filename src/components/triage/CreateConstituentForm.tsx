/**
 * CreateConstituentForm
 *
 * Inline form for creating a new constituent, used in accordion.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, User, Mail, MapPin, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { useTriageActions } from '@/hooks/triage/useTriage';

interface CreateConstituentFormProps {
  onCreated?: (constituentId: string) => void;
  onCancel?: () => void;
  defaultEmail?: string;
  defaultName?: string;
  defaultAddress?: string;
}

export function CreateConstituentForm({
  onCreated,
  onCancel,
  defaultEmail = '',
  defaultName = '',
  defaultAddress = '',
}: CreateConstituentFormProps) {
  const { createConstituentWithContacts, isProcessing } = useTriageActions();

  const [formData, setFormData] = useState({
    full_name: defaultName,
    email: defaultEmail,
    address: defaultAddress,
    phone: '',
  });

  // Update form when defaults change
  useEffect(() => {
    setFormData({
      full_name: defaultName,
      email: defaultEmail,
      address: defaultAddress,
      phone: '',
    });
  }, [defaultName, defaultEmail, defaultAddress]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.full_name.trim()) {
      toast.error('Name is required');
      return;
    }

    const result = await createConstituentWithContacts({
      full_name: formData.full_name.trim(),
      email: formData.email.trim() || undefined,
      address: formData.address.trim() || undefined,
      phone: formData.phone.trim() || undefined,
    });

    if (result.success && result.constituentId) {
      toast.success(`Constituent "${formData.full_name}" created`);
      onCreated?.(result.constituentId);
    } else {
      toast.error(result.error || 'Failed to create constituent');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="inline_full_name" className="text-xs">Full Name *</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="inline_full_name"
            placeholder="Enter full name"
            value={formData.full_name}
            onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
            className="pl-10 h-9"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="inline_email" className="text-xs">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="inline_email"
            type="email"
            placeholder="email@example.com"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            className="pl-10 h-9"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="inline_address" className="text-xs">Address</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="inline_address"
            placeholder="Street address"
            value={formData.address}
            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
            className="pl-10 h-9"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="inline_phone" className="text-xs">Phone</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="inline_phone"
            type="tel"
            placeholder="Phone number"
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            className="pl-10 h-9"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={isProcessing || !formData.full_name.trim()}
          className="flex-1"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Constituent'
          )}
        </Button>
      </div>
    </form>
  );
}
