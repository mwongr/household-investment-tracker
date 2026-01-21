import React, { useState } from 'react';
import { Plus, Trash2, X, Save, Building, Pencil } from 'lucide-react';
import { useData } from '../context/DataContext';
import type { Institution } from '../types';
import '../styles/shared.css';

const Institutions = () => {
    const { institutions, addInstitution, updateInstitution, deleteInstitution } = useData();
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newName, setNewName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newName.trim()) {
            if (isEditing && editingId) {
                updateInstitution(editingId, newName.trim());
            } else {
                addInstitution(newName.trim());
            }
            resetForm();
        }
    };

    const startEdit = (inst: Institution) => {
        setIsEditing(true);
        setEditingId(inst.id);
        setNewName(inst.name);
    };

    const resetForm = () => {
        setIsEditing(false);
        setEditingId(null);
        setNewName('');
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Institutions</h1>
                {!isEditing && (
                    <button
                        className="btn btn-primary"
                        onClick={() => setIsEditing(true)}
                    >
                        <Plus size={18} />
                        Add Institution
                    </button>
                )}
            </div>

            <div className="card">
                {isEditing && (
                    <form onSubmit={handleSubmit} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 mb-6 flex gap-4 items-center">
                        <input
                            type="text"
                            placeholder="Enter institution name (e.g. Questrade)..."
                            className="input max-w-md"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            autoFocus
                        />
                        <button type="submit" className="btn btn-primary">
                            <Save size={18} />
                            {editingId ? 'Update' : 'Save'}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={resetForm}
                        >
                            <X size={18} />
                            Cancel
                        </button>
                    </form>
                )}

                {institutions.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">
                        No institutions added yet.
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {institutions.map((inst) => (
                                    <tr key={inst.id}>
                                        <td className="font-medium text-white flex items-center gap-2">
                                            <Building size={16} className="text-slate-400" />
                                            {inst.name}
                                        </td>
                                        <td className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={() => startEdit(inst)}
                                                    title="Edit Institution"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    className="btn btn-danger"
                                                    onClick={() => deleteInstitution(inst.id)}
                                                    title="Delete Institution"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Institutions;
