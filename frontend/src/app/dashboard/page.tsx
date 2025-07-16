'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { 
  ChartBarIcon, 
  ClockIcon, 
  UserGroupIcon, 
  DocumentTextIcon,
  ComputerDesktopIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface DashboardStats {
  totalStudies: number;
  pendingStudies: number;
  completedReports: number;
  activeUsers: number;
  urgentStudies: number;
  averageReportTime: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudies: 0,
    pendingStudies: 0,
    completedReports: 0,
    activeUsers: 0,
    urgentStudies: 0,
    averageReportTime: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading stats
    setTimeout(() => {
      setStats({
        totalStudies: 1,
        pendingStudies: 1,
        completedReports: 0,
        activeUsers: 1,
        urgentStudies: 0,
        averageReportTime: 0,
      });
      setIsLoading(false);
    }, 1000);
  }, []);

  const statCards = [
    {
      name: 'Total Studies',
      value: stats.totalStudies,
      icon: ComputerDesktopIcon,
      color: 'bg-blue-500',
      change: '+12%',
      changeType: 'positive',
    },
    {
      name: 'Pending Studies',
      value: stats.pendingStudies,
      icon: ClockIcon,
      color: 'bg-yellow-500',
      change: '+5%',
      changeType: 'neutral',
    },
    {
      name: 'Completed Reports',
      value: stats.completedReports,
      icon: DocumentTextIcon,
      color: 'bg-green-500',
      change: '+8%',
      changeType: 'positive',
    },
    {
      name: 'Active Users',
      value: stats.activeUsers,
      icon: UserGroupIcon,
      color: 'bg-purple-500',
      change: '+2%',
      changeType: 'positive',
    },
  ];

  const StatCard = ({ stat, index }: { stat: any; index: number }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`w-10 h-10 rounded-full ${stat.color} flex items-center justify-center`}>
              <stat.icon className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                {stat.name}
              </dt>
              <dd className="text-2xl font-semibold text-gray-900 dark:text-white">
                {isLoading ? (
                  <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
                ) : (
                  stat.value
                )}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 dark:text-white sm:text-3xl sm:truncate">
            Welcome back, {user?.first_name}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Here's what's happening with your radiology platform today.
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <button
            type="button"
            className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            View All Studies
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <StatCard key={stat.name} stat={stat} index={index} />
        ))}
      </div>

      {/* Urgent Studies Alert */}
      {stats.urgentStudies > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
        >
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Urgent Studies Require Attention
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                <p>
                  You have {stats.urgentStudies} urgent studies that need immediate review.
                </p>
              </div>
              <div className="mt-4">
                <div className="-mx-2 -my-1.5 flex">
                  <button
                    type="button"
                    className="bg-red-50 dark:bg-red-900/20 px-2 py-1.5 rounded-md text-sm font-medium text-red-800 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600"
                  >
                    Review Urgent Studies
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Studies */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Recent Studies
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {/* Sample study */}
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                  <ComputerDesktopIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Test Study from DICOM Library
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    CT • Test Patient
                  </p>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Just now
                </div>
              </div>

              {/* Empty state */}
              {stats.totalStudies === 0 && (
                <div className="text-center py-8">
                  <ComputerDesktopIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                    No studies yet
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Studies will appear here when they are uploaded.
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Quick Actions
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-4">
              <a
                href="/dashboard/studies"
                className="flex items-center p-3 text-sm font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <ComputerDesktopIcon className="w-5 h-5 mr-3 text-gray-400" />
                View All Studies
              </a>
              <a
                href="/dashboard/reports"
                className="flex items-center p-3 text-sm font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <DocumentTextIcon className="w-5 h-5 mr-3 text-gray-400" />
                Create New Report
              </a>
              <a
                href="/dashboard/settings"
                className="flex items-center p-3 text-sm font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <UserGroupIcon className="w-5 h-5 mr-3 text-gray-400" />
                Manage Users
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}