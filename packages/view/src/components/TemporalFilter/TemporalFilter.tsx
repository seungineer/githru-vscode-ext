import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { FiRefreshCcw } from "react-icons/fi";

import { useGlobalData } from "hooks";
import { throttle } from "utils";

import { vscode } from "../../ide/VSCodeAPIWrapper";

import {
  filterDataByDate,
  getMinMaxDate,
  lineChartTimeFormatter,
  sortBasedOnCommitNode,
} from "./TemporalFilter.util";
import "./TemporalFilter.scss";
import drawLineChart from "./LineChart";
import type { LineChartData } from "./LineChart";
import { useWindowResize } from "./TemporalFilter.hook";
import { drawBrush } from "./LineChartBrush";
import {
  BRUSH_MARGIN,
  TEMPORAL_FILTER_LINE_CHART_STYLES,
} from "./LineChart.const";

const TemporalFilter = () => {
  const { data, filteredData, setFilteredData } = useGlobalData();
  const sortedFilteredData = useMemo(
    () => sortBasedOnCommitNode(filteredData),
    [filteredData]
  );
  const sortedData = sortBasedOnCommitNode(data);
  const [minDate, maxDate] = getMinMaxDate(sortedData);
  const [filteredPeriod, setFilteredPeriod] = useState({
    fromDate: minDate,
    toDate: maxDate,
  });

  const wrapperRef = useRef<HTMLDivElement>(null);
  const ref = useRef<SVGSVGElement>(null);

  const sortedCommitData = sortBasedOnCommitNode(filteredData);

  const lineChartDataList: LineChartData[][] = useMemo(() => {
    const clocMap: Map<string, number> = new Map();
    const commitMap: Map<string, number> = new Map();

    sortedCommitData.forEach(({ commit }) => {
      const formattedDate = lineChartTimeFormatter(new Date(commit.commitDate));
      const clocMapItem = clocMap.get(formattedDate);
      const commitMapItem = commitMap.get(formattedDate);

      const clocValue =
        commit.diffStatistics.insertions + commit.diffStatistics.deletions;

      commitMap.set(formattedDate, clocMapItem ? clocMapItem + 1 : 1);
      clocMap.set(
        formattedDate,
        commitMapItem ? commitMapItem + clocValue : clocValue
      );
    });

    const buildReturnArray = (map: Map<string, number>) =>
      Array.from(map.entries()).map(([key, value]) => {
        return {
          dateString: key,
          value: value,
        };
      });

    return [buildReturnArray(clocMap), buildReturnArray(commitMap)];
  }, [sortedCommitData]);

  const fromDateChangeHandler = ({
    target,
  }: React.ChangeEvent<HTMLInputElement>): void => {
    const { toDate } = filteredPeriod;
    const fromDate = target.value;

    setFilteredPeriod({ fromDate, toDate });

    if (fromDate === "" || toDate === "") {
      setFilteredData(data);
    } else {
      setFilteredData(filterDataByDate({ data, fromDate, toDate }));
    }
  };

  const toDateChangeHandler = ({
    target,
  }: React.ChangeEvent<HTMLInputElement>): void => {
    const { fromDate } = filteredPeriod;
    const toDate = target.value;

    setFilteredPeriod({ fromDate, toDate });

    if (fromDate === "" || toDate === "") {
      setFilteredData(data);
    } else {
      setFilteredData(filterDataByDate({ data, fromDate, toDate }));
    }
  };

  const refreshHandler = throttle(() => {
    const message = {
      command: "refresh",
    };
    vscode.postMessage(message);
  }, 3000);

  const windowSize = useWindowResize();

  useEffect(() => {
    if (!wrapperRef.current || !ref.current) return undefined;

    const axisHeight = 20;
    const chartHeight =
      (wrapperRef.current.getBoundingClientRect().height - axisHeight) / 2;
    const svgElement = ref.current;

    // CLOC
    const xScale = drawLineChart(
      svgElement,
      lineChartDataList[0],
      TEMPORAL_FILTER_LINE_CHART_STYLES.margin,
      windowSize.width,
      chartHeight,
      0,
      false,
      "CLOC #"
    );

    // COMMIT
    drawLineChart(
      svgElement,
      lineChartDataList[1],
      TEMPORAL_FILTER_LINE_CHART_STYLES.margin,
      windowSize.width,
      chartHeight,
      chartHeight,
      true,
      "COMMIT #"
    );

    const dateChangeHandler = (fromDate: string, toDate: string) => {
      setFilteredData(filterDataByDate({ data, fromDate, toDate }));
    };

    drawBrush(
      xScale,
      svgElement,
      BRUSH_MARGIN,
      windowSize.width,
      chartHeight * 2,
      dateChangeHandler
    );

    return () => {
      d3.select(svgElement).selectAll("g").remove();
    };
  }, [
    data,
    lineChartDataList,
    setFilteredData,
    sortedFilteredData,
    windowSize,
  ]);

  return (
    <article className="temporal-filter">
      <div className="data-control-container">
        <button
          type="button"
          className="refresh-button"
          onClick={refreshHandler}
        >
          <FiRefreshCcw />
        </button>
        <section className="filter">
          <form>
            <div>
              <span>From:</span>
              <input
                className="date-from"
                type="date"
                min={minDate}
                max={maxDate}
                value={filteredPeriod.fromDate}
                onChange={fromDateChangeHandler}
              />
              <span>To:</span>
              <input
                className="date-to"
                type="date"
                min={minDate}
                max={maxDate}
                value={filteredPeriod.toDate}
                onChange={toDateChangeHandler}
              />
            </div>
          </form>
        </section>
      </div>
      <div className="line-charts" ref={wrapperRef}>
        <svg className="line-charts-svg" ref={ref} />
      </div>
    </article>
  );
};

export default TemporalFilter;
