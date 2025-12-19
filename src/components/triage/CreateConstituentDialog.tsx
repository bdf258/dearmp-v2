/**
 * CreateConstituentDialog
 *
 * Modal dialog for creating a new constituent with contact fields.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, User, Mail, MapPin, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { useTriageActions } from '@/hooks/triage/useTriage';

interface CreateConstituentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (constituentId: string) => void;
  defaultEmail?: string;
  defaultName?: string;
  defaultAddress?: string;
}

export function CreateConstituentDialog({
  open,
  onOpenChange,
  onCreated,
  defaultEmail = '',
  defaultName = '',
  defaultAddress = '',
}: CreateConstituentDialogProps) {
  const { createConstituentWithContacts, isProcessing } = useTriageActions();

  const [formData, setFormData] = useState({
    full_name: defaultName,
    email: defaultEmail,
    address: defaultAddress,
    phone: '',
  });

  // Reset form when dialog opens with defaults
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setFormData({
        full_name: defaultName,
        email: defaultEmail,
        address: defaultAddress,
        phone: '',
      });
    }
    onOpenChange(isOpen);
  };

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
      onOpenChange(false);
    } else {
      toast.error(result.error || 'Failed to create constituent');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Create New Constituent
          </DialogTitle>
          <DialogDescription>
            Add a new constituent to your records.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name *</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="full_name"
                placeholder="Enter full name"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                className="pl-10"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="address"
                placeholder="Street address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                placeholder="Phone number"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="pl-10"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isProcessing || !formData.full_name.trim()}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Constituent'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
