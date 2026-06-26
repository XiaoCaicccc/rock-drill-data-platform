'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { PageHeader } from '@/components/common/PageHeader'
import TaskBoard from '@/components/workspace/TaskBoard'
import MeetingManager from '@/components/workspace/MeetingManager'
import DocumentArchive from '@/components/workspace/DocumentArchive'
import AttendanceHelper from '@/components/workspace/AttendanceHelper'
import { ListTodo, CalendarDays, FolderOpen, CalendarCheck } from 'lucide-react'

const TABS = [
  { value: 'tasks', label: '任务管理', icon: ListTodo },
  { value: 'meetings', label: '会议管理', icon: CalendarDays },
  { value: 'documents', label: '文件归档', icon: FolderOpen },
  { value: 'attendance', label: '考勤辅助', icon: CalendarCheck },
] as const

export default function WorkspaceView() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="部门工作台"
        description="任务看板、会议组织与纪要、文件归档、考勤辅助等部门助理功能"
      />

      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList>
          {TABS.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
              <tab.icon className="size-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="tasks">
          <TaskBoard />
        </TabsContent>

        <TabsContent value="meetings">
          <MeetingManager />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentArchive />
        </TabsContent>

        <TabsContent value="attendance">
          <AttendanceHelper />
        </TabsContent>
      </Tabs>
    </div>
  )
}