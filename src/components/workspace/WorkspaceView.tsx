'use client'

import { PlaceholderView } from '@/components/views/PlaceholderView'
import { Briefcase } from 'lucide-react'

export default function WorkspaceView() {
  return (
    <PlaceholderView
      viewKey="workspace"
      icon={<Briefcase className="size-8" />}
      description="部门工作台 —— 任务管理、会议组织与纪要、决议跟踪、文件归档、考勤辅助等部门助理功能。"
    />
  )
}