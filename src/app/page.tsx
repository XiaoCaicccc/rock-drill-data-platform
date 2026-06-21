'use client'

import ReportView from '@/components/reports/ReportView'
import TaskView from '@/components/tasks/TaskView'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { FileBarChart, ListTodo } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs defaultValue="reports" className="space-y-6">
          <TabsList>
            <TabsTrigger value="reports" className="gap-2">
              <FileBarChart className="size-4" />
              分析报告管理
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2">
              <ListTodo className="size-4" />
              部门工作台
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports">
            <ReportView />
          </TabsContent>

          <TabsContent value="tasks">
            <TaskView />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t py-4 mt-auto">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-muted-foreground">
            凿岩机零部件全生命周期数据分析平台
          </p>
        </div>
      </footer>
    </div>
  )
}
