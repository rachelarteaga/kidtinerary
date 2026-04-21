"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChildCard } from "@/components/kids/child-card";
import { ChildForm } from "@/components/kids/child-form";
import { useRouter } from "next/navigation";

interface Child {
  id: string;
  name: string;
  birth_date: string;
  interests: string[];
}

interface KidsPageClientProps {
  initialChildren: Child[];
}

export function KidsPageClient({ initialChildren }: KidsPageClientProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const router = useRouter();

  function handleDone() {
    setShowForm(false);
    setEditingChild(null);
    router.refresh();
  }

  function handleEdit(child: Child) {
    setEditingChild(child);
    setShowForm(true);
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-extrabold text-4xl mb-2">My Kids</h1>
          <p className="text-ink-2 text-lg">
            Manage your kids&apos; profiles and interests.
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>Add Kid</Button>
        )}
      </div>

      {showForm && (
        <div className="mb-6">
          <ChildForm editingChild={editingChild} onDone={handleDone} />
        </div>
      )}

      {initialChildren.length > 0 ? (
        <div className="space-y-4">
          {initialChildren.map((child: any) => (
            <ChildCard key={child.id} child={child} onEdit={handleEdit} />
          ))}
        </div>
      ) : (
        !showForm && (
          <div className="text-center py-16">
            <p className="font-display font-extrabold text-2xl mb-2">No kids added yet</p>
            <p className="text-ink-2 mb-6">
              Add your kids to get personalized activity recommendations.
            </p>
            <Button onClick={() => setShowForm(true)}>Add Your First Kid</Button>
          </div>
        )
      )}
    </main>
  );
}
