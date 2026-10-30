import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';

export const AdminPermissions = () => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await api.get('/admin/usuarios');
      return res.data.users;
    }
  });

  const mutation = useMutation({
    mutationFn: async ({ id, rol }: any) => {
      await api.put(`/admin/usuarios/${id}/rol`, { rol });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] })
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="bg-white dark:bg-neutral-800 p-6 rounded-xl border border-neutral-200 dark:border-neutral-700">
        <h1 className="text-2xl font-bold">Gobernanza de Administradores</h1>
        <p className="text-xs text-neutral-500 mt-1">Solo el SuperAdmin inmutable puede conceder permisos delegados</p>
      </div>
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse min-w-[500px]">
          <thead className="bg-neutral-50 dark:bg-neutral-900 text-xs uppercase text-neutral-500 font-semibold border-b">
            <tr>
              <th className="p-4">Email</th>
              <th className="p-4">Rol Actual</th>
              <th className="p-4">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {data?.map((u: any) => (
              <tr key={u.id} className="hover:bg-neutral-500/5">
                <td className="p-4 font-medium">{u.email}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                    u.rol === 'superadmin' ? 'bg-amber-100 text-amber-900 border border-amber-300' : u.rol === 'admin_delegado' ? 'bg-blue-100 text-blue-900' : 'bg-neutral-100 text-neutral-700'
                  }`}>
                    {u.rol}
                  </span>
                </td>
                <td className="p-4">
                  {u.rol === 'superadmin' ? (
                    <span className="text-xs text-neutral-400 italic">Inmutable</span>
                  ) : (
                    <button
                      onClick={() => mutation.mutate({ id: u.id, rol: u.rol === 'admin_delegado' ? 'user' : 'admin_delegado' })}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md border min-h-8 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    >
                      {u.rol === 'admin_delegado' ? 'Revocar Admin' : 'Hacer Admin Delegado'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
