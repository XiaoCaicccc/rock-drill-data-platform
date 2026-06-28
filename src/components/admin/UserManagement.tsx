'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, ShieldCheck, Users, UserX, Shield } from 'lucide-react'

import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'

// ─── Types ───

interface UserItem {
  id: string
  email: string
  name: string
  role: string
  active: boolean
  created_at: string
}

// ─── Component ───

export function UserManagement() {
  const { data: session } = useSession()
  const currentUserId = (session?.user as { id?: string })?.id
  const currentRole = (session?.user as { role?: string })?.role

  // Data
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserItem | null>(null)
  const [deleteUser, setDeleteUser] = useState<UserItem | null>(null)

  // Form state
  const [formLoading, setFormLoading] = useState(false)
  const [createForm, setCreateForm] = useState({ email: '', password: '', name: '', role: 'user' })
  const [editForm, setEditForm] = useState({ name: '', role: '', active: true })

  // ─── Fetch ───

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/users')
      if (res.status === 403) {
        setError('无权限访问')
        return
      }
      if (!res.ok) throw new Error('加载失败')
      const data = await res.json()
      setUsers(data.users)
    } catch {
      setError('加载用户列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // ─── Stats ───

  const stats = {
    total: users.length,
    admins: users.filter((u) => u.role === 'admin').length,
    normals: users.filter((u) => u.role === 'user').length,
    disabled: users.filter((u) => !u.active).length,
  }

  // ─── Create ───

  async function handleCreate() {
    if (!createForm.email || !createForm.password || !createForm.name) {
      toast.error('请填写所有必填字段')
      return
    }
    setFormLoading(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '创建失败')
        return
      }
      toast.success('用户创建成功')
      setCreateOpen(false)
      setCreateForm({ email: '', password: '', name: '', role: 'user' })
      fetchUsers()
    } catch {
      toast.error('创建失败')
    } finally {
      setFormLoading(false)
    }
  }

  // ─── Edit ───

  function openEdit(user: UserItem) {
    setEditUser(user)
    setEditForm({ name: user.name, role: user.role, active: user.active })
  }

  async function handleEdit() {
    if (!editUser) return
    setFormLoading(true)
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editUser.id, ...editForm }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '更新失败')
        return
      }
      toast.success('用户更新成功')
      setEditUser(null)
      fetchUsers()
    } catch {
      toast.error('更新失败')
    } finally {
      setFormLoading(false)
    }
  }

  // ─── Delete ───

  async function handleDelete() {
    if (!deleteUser) return
    setFormLoading(true)
    try {
      const res = await fetch(`/api/users/${deleteUser.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '删除失败')
        return
      }
      toast.success('用户已删除')
      setDeleteUser(null)
      fetchUsers()
    } catch {
      toast.error('删除失败')
    } finally {
      setFormLoading(false)
    }
  }

  // ─── Skeleton ───

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  // ─── Error ───

  if (error) {
    return (
      <div className="p-6">
        <EmptyState
          icon={UserX}
          title={error}
          description="请确认您已登录且具有管理员权限"
          action={
            <Button variant="outline" onClick={fetchUsers}>
              重新加载
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="用户管理"
        description="管理系统用户账号、角色和权限"
        actions={
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="mr-1.5 size-4" />
            新建用户
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="总用户数"
          value={stats.total}
          icon={Users}
          className="border-l-4 border-l-blue-500"
        />
        <StatCard
          title="管理员"
          value={stats.admins}
          icon={ShieldCheck}
          className="border-l-4 border-l-amber-500"
        />
        <StatCard
          title="普通用户"
          value={stats.normals}
          icon={Users}
          className="border-l-4 border-l-emerald-500"
        />
        <StatCard
          title="已禁用"
          value={stats.disabled}
          icon={UserX}
          className="border-l-4 border-l-red-500"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="hidden sm:table-cell">创建日期</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState icon={Users} title="暂无用户" description="点击上方按钮创建第一个用户" />
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={user.role === 'admin' ? 'default' : 'secondary'}
                      className={user.role === 'admin' ? 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/20' : ''}
                    >
                      {user.role === 'admin' ? '管理员' : '用户'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={user.active ? '启用' : '禁用'} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {format(new Date(user.created_at), 'yyyy-MM-dd')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => openEdit(user)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {user.id !== currentUserId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteUser(user)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建用户</DialogTitle>
            <DialogDescription>创建一个新的系统用户账号</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>邮箱 *</Label>
              <Input
                placeholder="user@example.com"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>密码 *</Label>
              <Input
                type="password"
                placeholder="请输入密码"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>姓名 *</Label>
              <Input
                placeholder="用户姓名"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>角色 *</Label>
              <Select
                value={createForm.role}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, role: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">普通用户</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={formLoading}>
              {formLoading ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
            <DialogDescription>修改用户信息（邮箱不可更改）</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input value={editUser?.email ?? ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) => setEditForm((f) => ({ ...f, role: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">普通用户</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>启用状态</Label>
              <Switch
                checked={editForm.active}
                onCheckedChange={(v) => setEditForm((f) => ({ ...f, active: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              取消
            </Button>
            <Button onClick={handleEdit} disabled={formLoading}>
              {formLoading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteUser}
        onOpenChange={(open) => !open && setDeleteUser(null)}
        title="确认删除用户"
        description={`确定要删除用户「${deleteUser?.name}」吗？此操作不可撤销。`}
        onConfirm={handleDelete}
        loading={formLoading}
        variant="destructive"
      />
    </div>
  )
}