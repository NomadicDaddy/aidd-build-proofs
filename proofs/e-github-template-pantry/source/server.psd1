@{
	Server = @{
		AutoImport = @{
			Modules = @{
				Enable = $true
				ExportOnly = $true
			}
			Snapins = @{
				Enable = $false
			}
		}
        FileMonitor = @{
            Enable = $false
			Include = @("*.pode", "*.ps1")
			Exclude = @('podex.ps1')
            ShowFiles = $true
        }
		Request = @{
				Timeout = 600
		}
	}
	Web = @{
		ErrorPages = @{
			# Default OFF. When $false, uncaught errors render the generic 'errors/default.html.pode'
			# page (no exception message/stack trace), so file paths and internals are never disclosed
			# to clients; full details are still captured server-side via Enable-PodeErrorLogging. Flip
			# to $true only as an explicit local-dev opt-in on a trusted machine; never in a
			# shared/exposed deployment. Mirrors the Podex.Debug posture below.
			ShowExceptions = $false
		}
		Static = @{
			Cache = @{
				Enable = $false
			}
		}
	}
	PodeCfg = @{
		HttpPort = 8433
		HttpUrl = 'localhost'
		CertThumbprint = ''
		HttpsEnabled = $false
	}
	Podex = @{
		# Default OFF. Debug enables terminal error logging, the route dump, AND registration of the
		# destructive dev-only routes (/stop, /clear, /init). Flip to $true only for local dev on a
		# trusted machine; never in a shared/exposed deployment.
		Debug = $false
		DatabaseType = 'SQLite'
		DBFile = './podex.db'
	}
}
