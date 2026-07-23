import { useState, useMemo } from 'react';
import { Twitter, Instagram, Calendar, Filter, Hash, Type, BarChart, FileJson, UploadCloud, Send } from 'lucide-react';
import { usePosts } from '@/hooks/usePosts';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

type Platform = 'twitter' | 'instagram';
type DayFilter = 'All' | 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

const WorkflowTest = () => {
  const { t } = useTranslation();
  const { addPost } = usePosts();
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [dayFilter, setDayFilter] = useState<DayFilter>('All');
  const [showJson, setShowJson] = useState(false);
  
  const [workflowData, setWorkflowData] = useState<any>(null);
  const [jsonInput, setJsonInput] = useState('');

  const handleImport = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (!parsed.instagram || !parsed.twitter) {
        throw new Error(t("workflowTest.toastMissingPlatforms"));
      }
      setWorkflowData(parsed);
      toast.success(t("workflowTest.toastStrategyLoaded"));
      setJsonInput(''); // clear input
    } catch (e) {
      toast.error(t("workflowTest.toastInvalidJson"));
    }
  };

  const handlePushToCalendar = () => {
    if (!workflowData) return;
    let count = 0;

    // Push IG posts
    workflowData.instagram.forEach((post: any) => {
      count++;
      addPost.mutate({
        post: {
          title: `IG: ${post.topic || 'Strategy'} (${post.day})`,
          content: `<p><img src="${post.image}" alt="cover" width="200"/></p><p>${post.content}</p><br/><p>${post.hashtags?.join(' ') || ''}</p>`,
          type: 'carousel',
          status: 'scheduled',
          scheduled_at: new Date().toISOString(), // In reality, calculate based on post.day
        },
        platforms: ['instagram']
      });
    });

    // Push Twitter threads
    workflowData.twitter.forEach((dayData: any) => {
      count += dayData.tweets.length;
      addPost.mutate({
        post: {
          title: `X Thread (${dayData.day})`,
          content: `<p><img src="${dayData.image}" alt="cover" width="200"/></p>` + dayData.tweets.map((t: string) => `<p>${t}</p>`).join('<hr/>'),
          type: 'thread',
          status: 'scheduled',
          scheduled_at: new Date().toISOString(),
        },
        platforms: ['twitter']
      });
    });

    toast.success(t("workflowTest.toastPushedPosts", { count }));
  };

  // Compute Stats
  const stats = useMemo(() => {
    if (!workflowData) return null;
    let totalPosts = 0;
    let totalChars = 0;
    let totalHashtags = 0;

    workflowData.instagram.forEach((post: any) => {
      totalPosts++;
      totalChars += post.content?.length || 0;
      totalHashtags += post.hashtags?.length || 0;
    });

    workflowData.twitter.forEach((dayInfo: any) => {
      dayInfo.tweets.forEach((tweet: string) => {
        totalPosts++;
        totalChars += tweet.length;
        const hashMatches = tweet.match(/#[\w]+/g);
        if (hashMatches) totalHashtags += hashMatches.length;
      });
    });

    return {
      totalPosts,
      avgCharsPerPost: Math.round(totalChars / totalPosts),
      totalHashtags,
      igBaseCount: workflowData.instagram.length,
      twBaseCount: workflowData.twitter.reduce((acc: number, curr: any) => acc + curr.tweets.length, 0)
    };
  }, [workflowData]);

  const filteredInstagram = useMemo(() => {
    if (!workflowData) return [];
    if (dayFilter === 'All') return workflowData.instagram;
    return workflowData.instagram.filter((p: any) => p.day === dayFilter);
  }, [dayFilter, workflowData]);

  const filteredTwitter = useMemo(() => {
    if (!workflowData) return [];
    if (dayFilter === 'All') return workflowData.twitter;
    return workflowData.twitter.filter((p: any) => p.day === dayFilter);
  }, [dayFilter, workflowData]);

  const days: DayFilter[] = [
    'All', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="page-title mb-2">{t("workflowTest.title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("workflowTest.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          {workflowData && (
            <>
              <button
                onClick={() => setShowJson(!showJson)}
                className="flex items-center gap-2 px-4 py-2 border border-muted rounded-md hover:bg-muted transition-colors text-sm font-medium"
              >
                <FileJson className="w-4 h-4" />
                {showJson ? t("workflowTest.viewUI") : t("workflowTest.viewPayloadDetails")}
              </button>
              <button
                onClick={handlePushToCalendar}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md shadow hover:bg-primary/90 transition-all text-sm font-semibold"
              >
                <Send className="w-4 h-4" />
                {t("workflowTest.approveAndSchedule")}
              </button>
            </>
          )}
        </div>
      </div>

      {!workflowData ? (
        <div className="flex flex-col gap-4 border-2 border-dashed rounded-xl p-8 bg-muted/20 items-center justify-center max-w-3xl mx-auto mt-12">
          <UploadCloud className="w-12 h-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">{t("workflowTest.importTitle")}</h2>
          <p className="text-muted-foreground text-center text-sm mb-4">
            {t("workflowTest.importDesc")}
          </p>
          <textarea
            className="w-full h-40 p-4 font-mono text-sm bg-background border rounded-lg focus:ring-2 outline-none"
            placeholder={t("workflowTest.pastePlaceholder")}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
          />
          <button
            onClick={handleImport}
            disabled={!jsonInput.trim()}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition"
          >
            {t("workflowTest.importButton")}
          </button>
        </div>
      ) : (
        <>
          {/* Stats Dashboard */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 border rounded-xl bg-card text-card-foreground shadow-sm flex flex-col gap-2">
                <div className="flex items-center text-muted-foreground gap-2"><BarChart className="w-4 h-4"/> {t("workflowTest.totalPosts")}</div>
                <div className="text-2xl font-semibold">{stats.totalPosts}</div>
                <div className="text-xs text-muted-foreground">{t("workflowTest.tweetsIgSuffix", { ig: stats.igBaseCount, count: stats.twBaseCount })}</div>
              </div>
              <div className="p-4 border rounded-xl bg-card text-card-foreground shadow-sm flex flex-col gap-2">
                <div className="flex items-center text-muted-foreground gap-2"><Type className="w-4 h-4"/> {t("workflowTest.avgCharsPerPost")}</div>
                <div className="text-2xl font-semibold">{stats.avgCharsPerPost}</div>
                <div className="text-xs text-muted-foreground">{t("workflowTest.maintainsReadability")}</div>
              </div>
              <div className="p-4 border rounded-xl bg-card text-card-foreground shadow-sm flex flex-col gap-2">
                <div className="flex items-center text-muted-foreground gap-2"><Hash className="w-4 h-4"/> {t("workflowTest.totalHashtagsStrategy")}</div>
                <div className="text-2xl font-semibold">{stats.totalHashtags}</div>
                <div className="text-xs text-muted-foreground">{t("workflowTest.seoOptimized")}</div>
              </div>
              <div className="p-4 border rounded-xl bg-card text-card-foreground shadow-sm flex flex-col gap-2">
                <div className="flex items-center text-muted-foreground gap-2"><Calendar className="w-4 h-4"/> {t("workflowTest.scheduleVolume")}</div>
                <div className="text-2xl font-semibold">{t("workflowTest.oneWeek")}</div>
                <div className="text-xs text-muted-foreground">{t("workflowTest.forwardPlanned")}</div>
              </div>
            </div>
          )}

          {showJson ? (
            <div className="bg-[#1e1e1e] text-[#d4d4d4] p-6 rounded-xl overflow-x-auto text-sm font-mono shadow-inner border border-[#333]">
              <pre>{JSON.stringify(workflowData, null, 2)}</pre>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Interactive Controls */}
              <div className="flex flex-col sm:flex-row justify-between gap-4 p-4 border rounded-xl bg-muted/30">
                <div className="flex bg-muted p-1 rounded-lg">
                  <button
                    onClick={() => setPlatform('instagram')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${platform === 'instagram' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Instagram className="w-4 h-4" /> {t("workflowTest.instagram")} ({stats?.igBaseCount})
                  </button>
                  <button
                    onClick={() => setPlatform('twitter')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${platform === 'twitter' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Twitter className="w-4 h-4" /> {t("workflowTest.twitter")} ({stats?.twBaseCount})
                  </button>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
                  <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
                  {days.map(day => (
                    <button
                      key={day}
                      onClick={() => setDayFilter(day)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${dayFilter === day ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}
                    >
                      {t(`workflowTest.days.${day}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Display */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {platform === 'instagram' && filteredInstagram.map((post: any, idx: number) => (
                  <div key={idx} className="border rounded-xl overflow-hidden bg-card flex flex-col shadow-sm hover:shadow-md transition-shadow">
                    <div className="h-48 bg-muted relative border-b overflow-hidden group">
                      <img src={post.image} alt={post.topic} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                        {post.day}
                      </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col space-y-4">
                      <h3 className="font-semibold text-lg">{post.topic}</h3>
                      <p className="text-sm text-muted-foreground flex-1 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {post.hashtags?.map((tag: string, i: number) => (
                          <span key={i} className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-full">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {platform === 'twitter' && filteredTwitter.map((dayGroup: any, idx: number) => (
                  <div key={idx} className="border rounded-xl bg-card shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
                    <div className="px-5 py-3 border-b bg-muted/30 flex justify-between items-center">
                      <span className="font-semibold">{dayGroup.day} {t("workflowTest.thread")}</span>
                      <Twitter className="w-4 h-4 text-[#1DA1F2]" />
                    </div>
                    <div className="h-32 bg-muted relative border-b overflow-hidden">
                       <img src={dayGroup.image} alt={dayGroup.day} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-0 flex-1 flex flex-col divide-y">
                      {dayGroup.tweets.map((tweet: string, tIdx: number) => (
                        <div key={tIdx} className="p-4 flex flex-col gap-2 hover:bg-muted/10 transition-colors">
                          <p className="text-sm leading-relaxed">{tweet}</p>
                          <div className="flex justify-end items-center text-xs text-muted-foreground mt-1">
                            <span className={`${tweet.length > 250 ? 'text-orange-500' : ''} ${tweet.length > 280 ? 'text-red-500 font-bold' : ''}`}>
                              {t("workflowTest.charsOf280", { count: tweet.length })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default WorkflowTest;
